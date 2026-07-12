import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runScan } from "../scan/index.js";
import { addToAllowlist } from "../scan/allowlist.js";
import { scanContentDeterministic } from "../scan/scanner.js";
import { computeContentHash } from "../scan/hash.js";
import { verifyUnchangedSinceScan } from "../scan/index.js";
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

describe("scanContentDeterministic", () => {
  it("detects a known API key pattern", () => {
    const findings = scanContentDeterministic("const key = 'sk-abcdefghijklmnopqrstuvwx';");
    expect(findings.some((f) => f.pattern === "generic-api-key")).toBe(true);
  });

  it("detects an internal hostname", () => {
    const findings = scanContentDeterministic("接続先は http://192.168.1.10:5432 です");
    expect(findings.some((f) => f.pattern === "internal-host")).toBe(true);
  });

  it("finds nothing in clean prose", () => {
    const findings = scanContentDeterministic("今週は新機能を実装し、テストも整備しました。");
    expect(findings).toEqual([]);
  });
});

describe("runScan / allowlist", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "devblog-scan-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("blocks content containing a secret and reports the finding", () => {
    const config = makeConfig(root);
    const result = runScan(config, "APIキーは sk-abcdefghijklmnopqrstuvwx です");

    expect(result.passed).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("passes clean content and records a content hash", () => {
    const config = makeConfig(root);
    const content = "今週は新機能を実装しました。";
    const result = runScan(config, content);

    expect(result.passed).toBe(true);
    expect(result.contentHash).toBe(computeContentHash(content));
  });

  it("allows a human-reviewed false positive via the allowlist", () => {
    const config = makeConfig(root);
    const content = "ダミーキーの例: sk-abcdefghijklmnopqrstuvwx (実際には無効な値)";

    const first = runScan(config, content);
    expect(first.passed).toBe(false);

    addToAllowlist(config.allowlistPath, first.findings[0], "ドキュメント中のダミー値", "kochan-um");

    const second = runScan(config, content);
    expect(second.passed).toBe(true);
  });

  it("detects tampering after a passed scan via content hash mismatch", () => {
    const config = makeConfig(root);
    const original = "今週は新機能を実装しました。";
    const result = runScan(config, original);
    expect(result.passed).toBe(true);

    expect(verifyUnchangedSinceScan(original, result)).toBe(true);
    expect(verifyUnchangedSinceScan("改変された本文です。", result)).toBe(false);
  });
});
