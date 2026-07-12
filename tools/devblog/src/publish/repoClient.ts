import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export interface OpenPr {
  url: string;
  number: number;
  branch: string;
}

export interface CreatePrParams {
  branch: string;
  files: Array<{ relativePath: string; content: string }>;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export interface CreatedPr {
  url: string;
  number: number;
}

/** Talks to the publish repository. Kept behind an interface so orchestration logic is testable without network access. */
export interface PublishRepoClient {
  findOpenPrByBranchPrefix(branchPrefix: string): Promise<OpenPr | null>;
  createPullRequest(params: CreatePrParams): Promise<CreatedPr>;
}

export interface GhRepoClientOptions {
  /** `owner/repo` */
  repo: string;
  /** fine-grained PAT scoped to `repo`; passed to `gh`/`git` via GH_TOKEN env, never as a CLI argument. */
  token: string;
}

/** Real implementation: shells out to `git` + `gh` (both assumed present in CI, per repo convention). */
export class GhPublishRepoClient implements PublishRepoClient {
  constructor(private readonly options: GhRepoClientOptions) {}

  private env(): NodeJS.ProcessEnv {
    return { ...process.env, GH_TOKEN: this.options.token };
  }

  async findOpenPrByBranchPrefix(branchPrefix: string): Promise<OpenPr | null> {
    const output = execFileSync(
      "gh",
      ["pr", "list", "--repo", this.options.repo, "--state", "open", "--json", "number,url,headRefName"],
      { encoding: "utf-8", env: this.env() }
    );
    const prs = JSON.parse(output) as Array<{ number: number; url: string; headRefName: string }>;
    const match = prs.find((pr) => pr.headRefName.startsWith(branchPrefix));
    return match ? { url: match.url, number: match.number, branch: match.headRefName } : null;
  }

  async createPullRequest(params: CreatePrParams): Promise<CreatedPr> {
    const workDir = mkdtempSync(path.join(tmpdir(), "devblog-publish-"));
    try {
      execFileSync("gh", ["repo", "clone", this.options.repo, workDir], { encoding: "utf-8", env: this.env() });
      execFileSync("git", ["checkout", "-b", params.branch], { cwd: workDir, encoding: "utf-8" });

      for (const file of params.files) {
        const fullPath = path.join(workDir, file.relativePath);
        mkdirSync(path.dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, file.content, "utf-8");
      }

      execFileSync("git", ["add", "."], { cwd: workDir, encoding: "utf-8" });
      execFileSync("git", ["commit", "-m", params.commitMessage], { cwd: workDir, encoding: "utf-8" });
      execFileSync("git", ["push", "-u", "origin", params.branch], { cwd: workDir, encoding: "utf-8" });

      const prUrl = execFileSync(
        "gh",
        ["pr", "create", "--repo", this.options.repo, "--title", params.prTitle, "--body", params.prBody, "--head", params.branch],
        { cwd: workDir, encoding: "utf-8", env: this.env() }
      ).trim();

      const prNumber = Number.parseInt(prUrl.split("/").pop() ?? "", 10);
      return { url: prUrl, number: prNumber };
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}
