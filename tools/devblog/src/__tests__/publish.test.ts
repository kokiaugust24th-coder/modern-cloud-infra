import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runPublish, branchName } from "../publish/index.js";
import { ZennAdapter } from "../publish/adapters/zenn.js";
import type { PublishRepoClient, CreatePrParams, CreatedPr, OpenPr } from "../publish/repoClient.js";
import { appendLedgerEntry } from "../ledger.js";
import { computeContentHash } from "../scan/hash.js";
import type { Article, Digest, ScanResult } from "../types.js";
import type { DevblogConfig } from "../config.js";

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
    linter: { minBodyChars: 1, maxBodyChars: 100000, requiredFrontmatter: [] },
  };
}

function makeDigest(): Digest {
  return {
    period: { since: "2026-07-01T00:00:00.000Z", until: "2026-07-08T00:00:00.000Z" },
    generatedAt: "2026-07-08T00:00:00.000Z",
    commits: [
      {
        hash: "a".repeat(40),
        shortHash: "aaaaaaa",
        date: "2026-07-02T00:00:00.000Z",
        message: "feat: x",
        changedFiles: ["src/x.ts"],
        insertions: 1,
        deletions: 0,
      },
    ],
    openspecChanges: [
      { name: "add-x", status: "in-progress", completedTasks: 1, totalTasks: 2, proposalExcerpt: "x", designExcerpt: null },
    ],
    devlogEntries: [],
    isEmpty: false,
  };
}

function makeArticle(body = "本文です。".repeat(5)): Article {
  return {
    frontmatter: {
      title: "テスト記事",
      emoji: "📝",
      type: "tech",
      topics: ["add-x"],
      published: false,
      source_period: "a..b",
      source_commits: "aaaaaaa",
      template_version: "1.0.0",
      rubric_version: "1.0.0",
    },
    body,
    slug: "digest-2026-07-08",
  };
}

class FakeRepoClient implements PublishRepoClient {
  public createdPrs: CreatePrParams[] = [];
  constructor(private readonly existingPr: OpenPr | null = null, private readonly nextPr: CreatedPr = { url: "https://github.com/x/devblog/pull/1", number: 1 }) {}

  async findOpenPrByBranchPrefix(_branchPrefix: string): Promise<OpenPr | null> {
    return this.existingPr;
  }

  async createPullRequest(params: CreatePrParams): Promise<CreatedPr> {
    this.createdPrs.push(params);
    return this.nextPr;
  }
}

describe("runPublish", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "devblog-publish-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("creates a PR when the scan passed and no duplicate exists", async () => {
    const config = makeConfig(root);
    const article = makeArticle();
    const digest = makeDigest();
    const scanResult: ScanResult = { passed: true, findings: [], contentHash: computeContentHash(article.body) };
    const repoClient = new FakeRepoClient(null);

    const result = await runPublish(config, article, digest, scanResult, new ZennAdapter(), repoClient);

    expect(result.created).toBe(true);
    expect(result.pr?.url).toContain("pull/1");
    expect(repoClient.createdPrs).toHaveLength(1);
    expect(repoClient.createdPrs[0].files[0].relativePath).toBe("articles/digest-2026-07-08.md");
    expect(repoClient.createdPrs[0].files[0].content).toContain("published: true");
  });

  it("refuses to publish when the scan did not pass", async () => {
    const config = makeConfig(root);
    const article = makeArticle();
    const digest = makeDigest();
    const scanResult: ScanResult = { passed: false, findings: [{ pattern: "x", line: 1, excerpt: "x" }], contentHash: "irrelevant" };
    const repoClient = new FakeRepoClient(null);

    const result = await runPublish(config, article, digest, scanResult, new ZennAdapter(), repoClient);

    expect(result.created).toBe(false);
    expect(repoClient.createdPrs).toHaveLength(0);
  });

  it("refuses to publish when content changed since the scan (tampering detection)", async () => {
    const config = makeConfig(root);
    const article = makeArticle();
    const digest = makeDigest();
    const scanResult: ScanResult = { passed: true, findings: [], contentHash: computeContentHash("違う内容") };
    const repoClient = new FakeRepoClient(null);

    const result = await runPublish(config, article, digest, scanResult, new ZennAdapter(), repoClient);

    expect(result.created).toBe(false);
    expect(result.reason).toContain("再検査");
  });

  it("refuses to create a duplicate PR when one already exists for the same period", async () => {
    const config = makeConfig(root);
    const article = makeArticle();
    const digest = makeDigest();
    const scanResult: ScanResult = { passed: true, findings: [], contentHash: computeContentHash(article.body) };
    const repoClient = new FakeRepoClient({ url: "https://github.com/x/devblog/pull/9", number: 9, branch: branchName(digest) });

    const result = await runPublish(config, article, digest, scanResult, new ZennAdapter(), repoClient);

    expect(result.created).toBe(false);
    expect(result.pr?.number).toBe(9);
    expect(repoClient.createdPrs).toHaveLength(0);
  });

  it("refuses to publish when the ledger already records this period", async () => {
    const config = makeConfig(root);
    const article = makeArticle();
    const digest = makeDigest();
    appendLedgerEntry(config.ledgerPath, {
      articleId: "digest-2026-07-08",
      publishedAt: "2026-07-09T00:00:00.000Z",
      sourcePeriod: digest.period,
      sourceCommitRange: "aaaaaaa",
    });
    const scanResult: ScanResult = { passed: true, findings: [], contentHash: computeContentHash(article.body) };
    const repoClient = new FakeRepoClient(null);

    const result = await runPublish(config, article, digest, scanResult, new ZennAdapter(), repoClient);

    expect(result.created).toBe(false);
    expect(result.reason).toContain("公開済み");
  });
});

describe("ZennAdapter", () => {
  it("converts tweet and youtube URLs to Zenn embed syntax", () => {
    const article = makeArticle(
      [
        "参考ポスト: https://twitter.com/example/status/1234567890",
        "参考動画: https://www.youtube.com/watch?v=abc123XYZ",
      ].join("\n")
    );
    const digest = makeDigest();

    const converted = new ZennAdapter().convertArticle(article, digest);

    expect(converted.content).toContain("@[tweet](https://twitter.com/example/status/1234567890)");
    expect(converted.content).toContain("@[youtube](https://www.youtube.com/watch?v=abc123XYZ)");
  });
});
