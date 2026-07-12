import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { collectCommits } from "../collect/git.js";
import { collectOpenSpecChanges } from "../collect/openspec.js";
import { collectDevlogEntries } from "../collect/devlog.js";
import { runCollect } from "../collect/index.js";
import type { DevblogConfig } from "../config.js";

function initRepo(dir: string) {
  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
}

function commit(dir: string, files: Record<string, string>, message: string) {
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  execFileSync("git", ["add", "."], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", message], { cwd: dir });
}

describe("collectCommits", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "devblog-git-"));
    initRepo(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("collects commit metadata without diff bodies", () => {
    commit(dir, { "src/a.ts": "export const a = 1;\n" }, "feat: add a");

    const since = new Date(Date.now() - 60_000).toISOString();
    const until = new Date(Date.now() + 60_000).toISOString();
    const commits = collectCommits({ repoRoot: dir, since, until, excludePathPatterns: [] });

    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe("feat: add a");
    expect(commits[0].changedFiles).toEqual(["src/a.ts"]);
    expect(commits[0].insertions).toBe(1);
    // Ensure no field on the commit ever carries file content / diff text.
    expect(JSON.stringify(commits[0])).not.toContain("export const a");
  });

  it("excludes files matching exclude patterns", () => {
    commit(dir, { ".env": "SECRET=x\n", "src/b.ts": "export const b = 2;\n" }, "chore: config");

    const since = new Date(Date.now() - 60_000).toISOString();
    const until = new Date(Date.now() + 60_000).toISOString();
    const commits = collectCommits({
      repoRoot: dir,
      since,
      until,
      excludePathPatterns: [/\.env(\..*)?$/],
    });

    expect(commits[0].changedFiles).toEqual(["src/b.ts"]);
  });

  it("returns no commits for a period with no activity", () => {
    commit(dir, { "src/c.ts": "export const c = 3;\n" }, "feat: add c");

    const since = new Date(Date.now() + 3600_000).toISOString();
    const until = new Date(Date.now() + 7200_000).toISOString();
    const commits = collectCommits({ repoRoot: dir, since, until, excludePathPatterns: [] });

    expect(commits).toHaveLength(0);
  });
});

describe("collectOpenSpecChanges", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "devblog-openspec-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("collects proposal/design excerpts and task progress", () => {
    const changeDir = path.join(dir, "my-change");
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(path.join(changeDir, "proposal.md"), "# Why\nテスト提案\n");
    writeFileSync(path.join(changeDir, "design.md"), "# Context\n設計メモ\n");
    writeFileSync(path.join(changeDir, "tasks.md"), "- [x] 1.1 done\n- [ ] 1.2 todo\n");

    const since = new Date(Date.now() - 3600_000);
    const until = new Date(Date.now() + 3600_000);
    const changes = collectOpenSpecChanges({ changesDir: dir, since, until });

    expect(changes).toHaveLength(1);
    expect(changes[0].name).toBe("my-change");
    expect(changes[0].completedTasks).toBe(1);
    expect(changes[0].totalTasks).toBe(2);
    expect(changes[0].status).toBe("in-progress");
    expect(changes[0].proposalExcerpt).toContain("テスト提案");
  });

  it("returns an empty list when the changes directory does not exist", () => {
    const changes = collectOpenSpecChanges({
      changesDir: path.join(dir, "does-not-exist"),
      since: new Date(0),
      until: new Date(),
    });
    expect(changes).toEqual([]);
  });
});

describe("collectDevlogEntries", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "devblog-devlog-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses reference and embed candidate URLs", () => {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(
      path.join(dir, `${today}.md`),
      [
        "## 学び",
        "- 何かを学んだ",
        "",
        "## 参照",
        "- https://example.com/ref",
        "",
        "## 埋め込み候補",
        "- https://twitter.com/x/status/1",
      ].join("\n")
    );

    const entries = collectDevlogEntries({
      devlogDir: dir,
      since: new Date(Date.now() - 3600_000),
      until: new Date(Date.now() + 3600_000),
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].referenceUrls).toEqual(["https://example.com/ref"]);
    expect(entries[0].embedCandidateUrls).toEqual(["https://twitter.com/x/status/1"]);
  });

  it("does not error when the devlog directory is absent", () => {
    const entries = collectDevlogEntries({
      devlogDir: path.join(dir, "missing"),
      since: new Date(0),
      until: new Date(),
    });
    expect(entries).toEqual([]);
  });
});

describe("runCollect", () => {
  let repoDir: string;
  let workDir: string;
  let config: DevblogConfig;

  beforeEach(() => {
    repoDir = mkdtempSync(path.join(tmpdir(), "devblog-repo-"));
    initRepo(repoDir);
    workDir = mkdtempSync(path.join(tmpdir(), "devblog-work-"));

    config = {
      targetRepoRoot: repoDir,
      openspecChangesDir: path.join(repoDir, "openspec", "changes"),
      devlogDir: path.join(repoDir, "devlog"),
      digestDir: path.join(workDir, "digests"),
      draftsDir: path.join(workDir, "drafts"),
      ledgerPath: path.join(workDir, "published.jsonl"),
      allowlistPath: path.join(workDir, "scan-allowlist.json"),
      defaultPeriodDays: 7,
      excludePathPatterns: ["\\.env(\\..*)?$"],
      publishRepoEnvVar: "DEVBLOG_PUBLISH_REPO",
      publishRepoTokenEnvVar: "DEVBLOG_PUBLISH_REPO_TOKEN",
      llm: { provider: "anthropic", model: "claude-sonnet-5", apiKeyEnvVar: "TEST_API_KEY", maxRetries: 3, baseBackoffMs: 100, timeoutMs: 1000 },
      linter: { minBodyChars: 10, maxBodyChars: 10000, requiredFrontmatter: [] },
    };
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(workDir, { recursive: true, force: true });
  });

  it("produces an empty digest and writes no file when there is no activity", () => {
    const result = runCollect(config, { since: new Date(0).toISOString() });
    expect(result.digest.isEmpty).toBe(true);
    expect(result.digestPath).toBeNull();
  });

  it("produces a populated digest and writes a digest file when commits exist", () => {
    commit(repoDir, { "src/x.ts": "export const x = 1;\n" }, "feat: add x");
    const result = runCollect(config, { since: new Date(Date.now() - 60_000).toISOString() });

    expect(result.digest.isEmpty).toBe(false);
    expect(result.digest.commits).toHaveLength(1);
    expect(result.digestPath).not.toBeNull();
  });
});
