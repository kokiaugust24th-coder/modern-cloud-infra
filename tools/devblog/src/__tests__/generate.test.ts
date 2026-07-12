import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { runGenerate } from "../generate/index.js";
import { lintArticle } from "../generate/linter.js";
import type { LlmClient, LlmCompletionParams, LlmCompletionResult } from "../generate/llm.js";
import type { Digest, Article } from "../types.js";
import type { DevblogConfig } from "../config.js";

function makeDigest(overrides: Partial<Digest> = {}): Digest {
  return {
    period: { since: "2026-07-01T00:00:00.000Z", until: "2026-07-08T00:00:00.000Z" },
    generatedAt: "2026-07-08T00:00:00.000Z",
    commits: [
      {
        hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        shortHash: "aaaaaaa",
        date: "2026-07-02T00:00:00.000Z",
        message: "feat: add feature X",
        changedFiles: ["src/x.ts"],
        insertions: 10,
        deletions: 2,
      },
    ],
    openspecChanges: [
      {
        name: "add-feature-x",
        status: "in-progress",
        completedTasks: 2,
        totalTasks: 5,
        proposalExcerpt: "機能Xの提案",
        designExcerpt: null,
      },
    ],
    devlogEntries: [],
    isEmpty: false,
    ...overrides,
  };
}

function makeConfig(root: string): DevblogConfig {
  return {
    targetRepoRoot: root,
    openspecChangesDir: path.join(root, "openspec", "changes"),
    devlogDir: path.join(root, "devlog"),
    digestDir: path.join(root, "digests"),
    draftsDir: path.join(root, "drafts"),
    ledgerPath: path.join(root, "published.jsonl"),
    allowlistPath: path.join(root, "scan-allowlist.json"),
    defaultPeriodDays: 7,
    excludePathPatterns: [],
    publishRepoEnvVar: "DEVBLOG_PUBLISH_REPO",
    publishRepoTokenEnvVar: "DEVBLOG_PUBLISH_REPO_TOKEN",
    llm: { provider: "anthropic", model: "test-model", apiKeyEnvVar: "TEST_API_KEY", maxRetries: 2, baseBackoffMs: 1, timeoutMs: 1000 },
    linter: {
      minBodyChars: 5,
      maxBodyChars: 100000,
      requiredFrontmatter: [
        "title",
        "emoji",
        "type",
        "topics",
        "published",
        "source_period",
        "source_commits",
        "template_version",
        "rubric_version",
      ],
    },
  };
}

const VALID_OUTLINE = JSON.stringify({
  title: "今週の開発ログ",
  targetReader: "開発者",
  themes: [{ heading: "機能Xの追加", summary: "機能Xを追加した", needsDiagram: false }],
});

const VALID_DRAFT = [
  "## 機能Xの追加",
  "",
  "機能Xを追加しました。これはダイジェストに基づく具体的な記述です。".repeat(3),
].join("\n");

class ScriptedLlmClient implements LlmClient {
  private callIndex = 0;
  constructor(private readonly responses: Array<LlmCompletionResult | Error>) {}

  async complete(_params: LlmCompletionParams): Promise<LlmCompletionResult> {
    const response = this.responses[this.callIndex];
    this.callIndex += 1;
    if (response instanceof Error) throw response;
    return response;
  }

  get calls(): number {
    return this.callIndex;
  }
}

function textResult(text: string): LlmCompletionResult {
  return { text, inputTokens: 10, outputTokens: 20 };
}

describe("runGenerate", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "devblog-generate-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("returns no article for an empty digest without calling the LLM", async () => {
    const config = makeConfig(root);
    const llm = new ScriptedLlmClient([]);
    const result = await runGenerate(config, makeDigest({ isEmpty: true, commits: [], openspecChanges: [] }), llm);

    expect(result.article).toBeNull();
    expect(result.draftPath).toBeNull();
    expect(llm.calls).toBe(0);
  });

  it("generates an article with required frontmatter and recorded template/rubric versions", async () => {
    const config = makeConfig(root);
    const llm = new ScriptedLlmClient([
      textResult(VALID_OUTLINE),
      textResult(VALID_DRAFT),
      textResult(VALID_DRAFT),
    ]);

    const result = await runGenerate(config, makeDigest(), llm);

    expect(result.article).not.toBeNull();
    const article = result.article as Article;
    expect(article.frontmatter.title).toBe("今週の開発ログ");
    expect(article.frontmatter.template_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(article.frontmatter.rubric_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(article.frontmatter.source_commits).toBe("aaaaaaa");
    expect(article.body).toContain("## 情報源");
    expect(article.body).toContain("add-feature-x");

    expect(result.draftPath).not.toBeNull();
    const written = readFileSync(result.draftPath as string, "utf-8");
    const parsed = matter(written);
    expect(parsed.data.title).toBe("今週の開発ログ");
  });

  it("resumes from the outline stage when a later stage previously failed", async () => {
    const config = makeConfig(root);
    const failingLlm = new ScriptedLlmClient([
      textResult(VALID_OUTLINE),
      new Error("network error"),
    ]);

    await expect(runGenerate(config, makeDigest(), failingLlm)).rejects.toThrow();

    const stageDir = path.join(config.draftsDir, "digest-2026-07-08T00-00-00-000Z");
    expect(existsSync(path.join(stageDir, "outline.json"))).toBe(true);
    expect(existsSync(path.join(stageDir, "draft.md"))).toBe(false);
    // No partial final article file should have been written.
    expect(existsSync(path.join(config.draftsDir, "digest-2026-07-08T00-00-00-000Z.md"))).toBe(false);

    const resumingLlm = new ScriptedLlmClient([textResult(VALID_DRAFT), textResult(VALID_DRAFT)]);
    const result = await runGenerate(config, makeDigest(), resumingLlm);

    expect(result.article).not.toBeNull();
    // Outline stage was not re-invoked; only draft + critique ran.
    expect(resumingLlm.calls).toBe(2);
  });

  it("runs a lint-guided repair pass when the critique output fails the linter", async () => {
    const config = makeConfig(root);
    // One 100+ character sentence — trips textlint's sentence-length rule.
    const LINT_FAILING_DRAFT = ["## 機能Xの追加", "", `${"この機能はとても長い説明で、".repeat(12)}終わります。`].join("\n");
    // The repair response echoes the repair-prompt scaffolding, as observed
    // in a real run that leaked "## リンターの指摘" into a published draft.
    const ECHOED_REPAIR = ["## リンターの指摘", "- [textlint:sentence-length] 長すぎます", "", "## 本文", VALID_DRAFT].join("\n");
    const llm = new ScriptedLlmClient([
      textResult(VALID_OUTLINE),
      textResult(LINT_FAILING_DRAFT), // draft
      textResult(LINT_FAILING_DRAFT), // critique still bad
      textResult(ECHOED_REPAIR), // repair pass 1 fixes it (with echoed scaffolding)
    ]);

    const result = await runGenerate(config, makeDigest(), llm);

    expect(result.lint?.passed).toBe(true);
    expect(llm.calls).toBe(4); // outline + draft + critique + 1 repair
    expect(result.metadata?.stages.repair?.passes).toBe(1);
    const article = result.article as Article;
    // Echoed scaffolding must be stripped from the final body.
    expect(article.body).not.toContain("リンターの指摘");
    // The machine-generated attribution footer survives the repair round-trip
    // exactly once (not duplicated, not dropped).
    expect(article.body.match(/## 情報源/g)).toHaveLength(1);
  });

  it("gives up after the bounded number of repair passes and reports the lint failure", async () => {
    const config = makeConfig(root);
    const LINT_FAILING_DRAFT = ["## 機能Xの追加", "", `${"この機能はとても長い説明で、".repeat(12)}終わります。`].join("\n");
    const llm = new ScriptedLlmClient([
      textResult(VALID_OUTLINE),
      textResult(LINT_FAILING_DRAFT),
      textResult(LINT_FAILING_DRAFT),
      textResult(LINT_FAILING_DRAFT), // repair 1 fails
      textResult(LINT_FAILING_DRAFT), // repair 2 fails
    ]);

    const result = await runGenerate(config, makeDigest(), llm);

    expect(result.lint?.passed).toBe(false);
    expect(llm.calls).toBe(5); // outline + draft + critique + 2 repairs, then stop
    expect(result.metadata?.stages.repair?.passes).toBe(2);
  });

  it("propagates the error and writes no article file when the LLM call exhausts retries", async () => {
    const config = makeConfig(root);
    const llm = new ScriptedLlmClient([new Error("boom"), new Error("boom"), new Error("boom")]);

    await expect(runGenerate(config, makeDigest({ period: { since: "2026-08-01T00:00:00.000Z", until: "2026-08-08T00:00:00.000Z" } }), llm)).rejects.toThrow();

    const files = existsSync(config.draftsDir);
    if (files) {
      const { readdirSync } = await import("node:fs");
      const draftFiles = readdirSync(config.draftsDir).filter((f) => f.endsWith(".md") && !f.includes("digest-"));
      expect(draftFiles).toEqual([]);
    }
  });
});

describe("lintArticle", () => {
  function baseArticle(overrides: Partial<Article["frontmatter"]> = {}, body = "本文です。".repeat(10)): Article {
    return {
      frontmatter: {
        title: "タイトル",
        emoji: "📝",
        type: "tech",
        topics: [],
        published: false,
        source_period: "a..b",
        source_commits: "abc",
        template_version: "1.0.0",
        rubric_version: "1.0.0",
        ...overrides,
      },
      body,
      slug: "test-slug",
    };
  }

  it("passes for a well-formed article", async () => {
    const result = await lintArticle(baseArticle(), {
      minBodyChars: 5,
      maxBodyChars: 1000,
      requiredFrontmatter: ["title", "emoji"],
    });
    expect(result.passed).toBe(true);
  });

  it("fails when a required frontmatter field is missing", async () => {
    const article = baseArticle();
    // @ts-expect-error intentionally deleting a required field for the test
    delete article.frontmatter.title;

    const result = await lintArticle(article, {
      minBodyChars: 5,
      maxBodyChars: 1000,
      requiredFrontmatter: ["title"],
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.rule === "frontmatter-required")).toBe(true);
  });

  it("fails when the body is shorter than the configured minimum", async () => {
    const result = await lintArticle(baseArticle({}, "短い"), {
      minBodyChars: 100,
      maxBodyChars: 1000,
      requiredFrontmatter: [],
    });

    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.rule === "body-length")).toBe(true);
  });

  it("flags a heading level jump", async () => {
    const result = await lintArticle(baseArticle({}, "# H1\n#### H4 skipped levels\n本文です。".repeat(1)), {
      minBodyChars: 1,
      maxBodyChars: 100000,
      requiredFrontmatter: [],
    });

    expect(result.issues.some((i) => i.rule === "heading-hierarchy")).toBe(true);
  });
});
