import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Digest, GenerationMetadata } from "../types.js";
import type { LlmClient } from "./llm.js";
import type { TemplateAssets } from "./prompts.js";
import { buildOutlinePrompt, buildDraftPrompt, buildCritiquePrompt } from "./prompts.js";

export interface OutlineThemeItem {
  heading: string;
  summary: string;
  needsDiagram: boolean;
}

export interface Outline {
  title: string;
  targetReader: string;
  themes: OutlineThemeItem[];
}

export interface StageDir {
  dir: string;
}

const OUTLINE_MAX_TOKENS = 1500;
const DRAFT_MAX_TOKENS = 4000;
const CRITIQUE_MAX_TOKENS = 4000;

/**
 * Runs the three generation stages (outline -> draft -> critique), persisting
 * each stage's output as it completes so a later invocation targeting the
 * same stage directory resumes from the first missing stage instead of
 * redoing work (design.md D7).
 */
export async function runStages(
  stageDir: string,
  digest: Digest,
  assets: TemplateAssets,
  llm: LlmClient
): Promise<{ outline: Outline; draftBody: string; finalBody: string; metadata: GenerationMetadata }> {
  mkdirSync(stageDir, { recursive: true });

  const usage: GenerationMetadata["stages"] = {
    outline: { inputTokens: 0, outputTokens: 0 },
    draft: { inputTokens: 0, outputTokens: 0 },
    critique: { inputTokens: 0, outputTokens: 0 },
  };

  const outline = await runOutlineStage(stageDir, digest, assets, llm, usage);
  const draftBody = await runDraftStage(stageDir, digest, assets, llm, JSON.stringify(outline), usage);
  const finalBody = await runCritiqueStage(stageDir, digest, assets, llm, draftBody, usage);

  const metadata: GenerationMetadata = {
    model: "unknown", // filled in by caller, which knows the configured model name
    generatedAt: new Date().toISOString(),
    stages: usage,
    templateVersion: assets.templateVersion,
    rubricVersion: assets.rubricVersion,
  };

  return { outline, draftBody, finalBody, metadata };
}

async function runOutlineStage(
  stageDir: string,
  digest: Digest,
  assets: TemplateAssets,
  llm: LlmClient,
  usage: GenerationMetadata["stages"]
): Promise<Outline> {
  const outlinePath = path.join(stageDir, "outline.json");
  if (existsSync(outlinePath)) {
    return JSON.parse(readFileSync(outlinePath, "utf-8")) as Outline;
  }

  const { system, prompt } = buildOutlinePrompt(digest, assets);
  const result = await llm.complete({ system, prompt, maxTokens: OUTLINE_MAX_TOKENS });
  usage.outline = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };

  const outline = parseOutlineJson(result.text);
  writeFileSync(outlinePath, JSON.stringify(outline, null, 2), "utf-8");
  return outline;
}

async function runDraftStage(
  stageDir: string,
  digest: Digest,
  assets: TemplateAssets,
  llm: LlmClient,
  outlineJson: string,
  usage: GenerationMetadata["stages"]
): Promise<string> {
  const draftPath = path.join(stageDir, "draft.md");
  if (existsSync(draftPath)) {
    return readFileSync(draftPath, "utf-8");
  }

  const { system, prompt } = buildDraftPrompt(digest, assets, outlineJson);
  const result = await llm.complete({ system, prompt, maxTokens: DRAFT_MAX_TOKENS });
  usage.draft = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };

  writeFileSync(draftPath, result.text, "utf-8");
  return result.text;
}

async function runCritiqueStage(
  stageDir: string,
  digest: Digest,
  assets: TemplateAssets,
  llm: LlmClient,
  draftBody: string,
  usage: GenerationMetadata["stages"]
): Promise<string> {
  const finalPath = path.join(stageDir, "critique.md");
  if (existsSync(finalPath)) {
    return readFileSync(finalPath, "utf-8");
  }

  const { system, prompt } = buildCritiquePrompt(digest, assets, draftBody);
  const result = await llm.complete({ system, prompt, maxTokens: CRITIQUE_MAX_TOKENS });
  usage.critique = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };

  writeFileSync(finalPath, result.text, "utf-8");
  return result.text;
}

function parseOutlineJson(text: string): Outline {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  const parsed = JSON.parse(cleaned) as Outline;
  if (!parsed.title || !Array.isArray(parsed.themes)) {
    throw new Error("outline stage returned an unexpected shape");
  }
  return parsed;
}
