import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { TemplateAssets } from "./prompts.js";

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const TEMPLATES_DIR = path.join(packageRoot, "templates");

const VERSION_PATTERN = /v(\d+\.\d+\.\d+)/;

export function loadTemplateAssets(): TemplateAssets {
  const articleTemplate = readFileSync(path.join(TEMPLATES_DIR, "article-template.md"), "utf-8");
  const styleGuide = readFileSync(path.join(TEMPLATES_DIR, "style-guide.md"), "utf-8");
  const rubric = readFileSync(path.join(TEMPLATES_DIR, "rubric.md"), "utf-8");

  return {
    articleTemplate,
    styleGuide,
    rubric,
    templateVersion: extractVersion(articleTemplate),
    rubricVersion: extractVersion(rubric),
  };
}

function extractVersion(content: string): string {
  return VERSION_PATTERN.exec(content)?.[1] ?? "0.0.0";
}
