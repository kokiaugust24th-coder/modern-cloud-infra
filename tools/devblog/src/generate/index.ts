import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { DevblogConfig } from "../config.js";
import type { Article, Digest, GenerationMetadata, LintResult } from "../types.js";
import { loadTemplateAssets } from "./assets.js";
import type { LlmClient } from "./llm.js";
import { runStages } from "./stages.js";
import {
  appendSourceAttribution,
  stripLocalImageReferences,
  simplifyWoOkonauExpressions,
  useArabicNumeralsForCounters,
} from "./postprocess.js";
import { lintArticle } from "./linter.js";

export interface GenerateResult {
  /** null when the digest carried no activity — this is a normal, non-error outcome. */
  article: Article | null;
  lint: LintResult | null;
  metadata: GenerationMetadata | null;
  draftPath: string | null;
}

export async function runGenerate(
  config: DevblogConfig,
  digest: Digest,
  llm: LlmClient
): Promise<GenerateResult> {
  if (digest.isEmpty) {
    return { article: null, lint: null, metadata: null, draftPath: null };
  }

  const assets = loadTemplateAssets();
  const stageDir = path.join(config.draftsDir, stageDirName(digest));

  let outline;
  let finalBody: string;
  let metadata: GenerationMetadata;
  try {
    const stageResult = await runStages(stageDir, digest, assets, llm);
    outline = stageResult.outline;
    finalBody = stageResult.finalBody;
    metadata = { ...stageResult.metadata, model: config.llm.model };
  } catch (error) {
    // No partial article file must remain when generation fails outright;
    // stage-intermediate files stay so a retry can resume (design.md D7).
    throw error instanceof Error ? error : new Error(String(error));
  }

  let body = stripLocalImageReferences(finalBody);
  body = simplifyWoOkonauExpressions(body);
  body = useArabicNumeralsForCounters(body);
  body = appendSourceAttribution(body, digest);

  // The title comes straight from the LLM's outline-stage JSON and never
  // passes through the critique stage, so it needs the same deterministic
  // cleanup as the body — otherwise a redundant expression in the title
  // alone fails the linter (found via a real run: title contained "生成を行う").
  const title = useArabicNumeralsForCounters(simplifyWoOkonauExpressions(outline.title));

  const article: Article = {
    frontmatter: {
      title,
      emoji: "📝",
      type: "tech",
      topics: buildTopics(digest),
      published: false,
      source_period: `${digest.period.since}..${digest.period.until}`,
      source_commits: formatCommitRange(digest),
      template_version: assets.templateVersion,
      rubric_version: assets.rubricVersion,
    },
    body,
    slug: stageDirName(digest),
  };

  const lint = await lintArticle(article, config.linter);

  mkdirSync(config.draftsDir, { recursive: true });
  const draftPath = path.join(config.draftsDir, `${article.slug}.md`);
  const fileContent = matter.stringify(article.body, article.frontmatter);
  writeFileSync(draftPath, fileContent, "utf-8");
  writeFileSync(
    path.join(config.draftsDir, `${article.slug}.generation.json`),
    JSON.stringify({ metadata, lint }, null, 2),
    "utf-8"
  );

  return { article, lint, metadata, draftPath };
}

/** Removes any leftover stage directory for a digest, forcing a full regeneration. */
export function clearStageDir(config: DevblogConfig, digest: Digest): void {
  const stageDir = path.join(config.draftsDir, stageDirName(digest));
  if (existsSync(stageDir)) {
    rmSync(stageDir, { recursive: true, force: true });
  }
}

function stageDirName(digest: Digest): string {
  return `digest-${digest.period.until.replace(/[:.]/g, "-")}`;
}

function buildTopics(digest: Digest): string[] {
  return digest.openspecChanges.slice(0, 5).map((c) => c.name);
}

function formatCommitRange(digest: Digest): string {
  if (digest.commits.length === 0) return "";
  const first = digest.commits[digest.commits.length - 1].shortHash;
  const last = digest.commits[0].shortHash;
  return first === last ? first : `${first}..${last}`;
}
