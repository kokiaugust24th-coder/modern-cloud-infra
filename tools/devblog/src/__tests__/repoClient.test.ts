import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { GhPublishRepoClient } from "../publish/repoClient.js";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const mockedExecFileSync = vi.mocked(execFileSync);

describe("GhPublishRepoClient.createPullRequest", () => {
  beforeEach(() => {
    mockedExecFileSync.mockReset();
    mockedExecFileSync.mockImplementation((cmd, args) => {
      if (cmd === "gh" && args?.includes("create")) return "https://github.com/x/devblog/pull/1\n";
      return "";
    });
  });

  it("configures a local git identity before committing (CI runners carry none)", async () => {
    const client = new GhPublishRepoClient({ repo: "x/devblog", token: "test-token" });

    await client.createPullRequest({
      branch: "devblog/2026-07-05--2026-07-12",
      files: [{ relativePath: "articles/a.md", content: "本文" }],
      commitMessage: "devblog: 記事",
      prTitle: "title",
      prBody: "body",
    });

    const calls = mockedExecFileSync.mock.calls.map(([cmd, args]) => [cmd, args] as [string, string[]]);

    const configNameIndex = calls.findIndex(([cmd, args]) => cmd === "git" && args[0] === "config" && args[1] === "user.name");
    const configEmailIndex = calls.findIndex(([cmd, args]) => cmd === "git" && args[0] === "config" && args[1] === "user.email");
    const commitIndex = calls.findIndex(([cmd, args]) => cmd === "git" && args[0] === "commit");

    expect(configNameIndex).toBeGreaterThanOrEqual(0);
    expect(configEmailIndex).toBeGreaterThanOrEqual(0);
    expect(commitIndex).toBeGreaterThan(configNameIndex);
    expect(commitIndex).toBeGreaterThan(configEmailIndex);

    // Must be a local (repo-scoped) config, never --global, so it can't leak
    // into the CI runner's environment beyond this ephemeral clone.
    expect(calls[configNameIndex][1]).not.toContain("--global");
    expect(calls[configEmailIndex][1]).not.toContain("--global");
  });
});
