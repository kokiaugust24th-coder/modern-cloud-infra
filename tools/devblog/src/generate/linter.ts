import { createLinter, loadTextlintrc } from "textlint";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { LinterConfig } from "../config.js";
import type { Article, LintIssue, LintResult } from "../types.js";

const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const HEADING_PATTERN = /^(#{1,6})\s+/gm;

export async function lintArticle(article: Article, config: LinterConfig): Promise<LintResult> {
  const issues: LintIssue[] = [
    ...checkFrontmatter(article, config),
    ...checkHeadingHierarchy(article.body),
    ...checkBodyLength(article.body, config),
  ];

  issues.push(...(await checkLinkReachability(article.body)));
  issues.push(...(await checkJapaneseProse(article.body)));

  return { passed: issues.length === 0, issues };
}

function checkFrontmatter(article: Article, config: LinterConfig): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const field of config.requiredFrontmatter) {
    if (article.frontmatter[field] === undefined || article.frontmatter[field] === "") {
      issues.push({ rule: "frontmatter-required", message: `frontmatter に必須項目 "${field}" がありません` });
    }
  }
  return issues;
}

function checkHeadingHierarchy(body: string): LintIssue[] {
  const issues: LintIssue[] = [];
  let previousLevel = 1; // article title (H1) lives in frontmatter; body starts effectively at H1 conceptually
  let lineNumber = 0;
  let lastIndex = 0;

  for (const match of body.matchAll(HEADING_PATTERN)) {
    lineNumber += countNewlines(body, lastIndex, match.index ?? 0);
    lastIndex = match.index ?? 0;
    const level = match[1].length;
    if (level > previousLevel + 1) {
      issues.push({
        rule: "heading-hierarchy",
        message: `見出しレベルが ${previousLevel} から ${level} へ飛んでいます`,
        line: lineNumber + 1,
      });
    }
    previousLevel = level;
  }

  return issues;
}

function countNewlines(text: string, from: number, to: number): number {
  if (to <= from) return 0;
  return (text.slice(from, to).match(/\n/g) ?? []).length;
}

function checkBodyLength(body: string, config: LinterConfig): LintIssue[] {
  const length = body.replace(/\s/g, "").length;
  if (length < config.minBodyChars) {
    return [{ rule: "body-length", message: `本文が短すぎます(${length}文字 < 最小${config.minBodyChars}文字)` }];
  }
  if (length > config.maxBodyChars) {
    return [{ rule: "body-length", message: `本文が長すぎます(${length}文字 > 最大${config.maxBodyChars}文字)` }];
  }
  return [];
}

async function checkLinkReachability(body: string): Promise<LintIssue[]> {
  const urls = [...body.matchAll(MARKDOWN_LINK_PATTERN)].map((m) => m[1]);
  const uniqueUrls = [...new Set(urls)];
  const issues: LintIssue[] = [];

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          const response = await fetch(url, { method: "HEAD", signal: controller.signal });
          if (!response.ok) {
            issues.push({ rule: "link-reachability", message: `リンク先が到達不能です(${response.status}): ${url}` });
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {
        issues.push({ rule: "link-reachability", message: `リンク先の確認に失敗しました: ${url}` });
      }
    })
  );

  return issues;
}

const packageRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const TEXTLINTRC_PATH = path.join(packageRoot, ".textlintrc.json");

async function checkJapaneseProse(body: string): Promise<LintIssue[]> {
  try {
    const descriptor = await loadTextlintrc({ configFilePath: TEXTLINTRC_PATH });
    const linter = createLinter({ descriptor });
    const result = await linter.lintText(body, "article.md");
    return result.messages.map((message) => ({
      rule: `textlint:${message.ruleId ?? "unknown"}`,
      message: message.message,
      line: message.line,
    }));
  } catch {
    // textlint misconfiguration must not silently pass content through;
    // surface it as a single lint issue rather than crashing the pipeline.
    return [{ rule: "textlint:engine-error", message: "textlint の実行に失敗しました" }];
  }
}
