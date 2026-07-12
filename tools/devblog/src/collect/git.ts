import { execFileSync } from "node:child_process";
import type { CommitSummary } from "../types.js";

const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";

export interface GitCollectOptions {
  repoRoot: string;
  since: string;
  until: string;
  excludePathPatterns: RegExp[];
}

/**
 * Collects commit metadata only (hash, message, changed file paths, line stats).
 * Diff bodies and file contents are never read — this is the primary defense
 * against secret leakage into the digest (see design.md D3).
 */
export function collectCommits(options: GitCollectOptions): CommitSummary[] {
  const format = ["%H", "%h", "%aI", "%s"].join(FIELD_SEP);
  let output: string;
  try {
    output = execFileSync(
      "git",
      [
        "log",
        `--since=${options.since}`,
        `--until=${options.until}`,
        `--pretty=format:${RECORD_SEP}${format}`,
        "--numstat",
      ],
      { cwd: options.repoRoot, encoding: "utf-8", maxBuffer: 1024 * 1024 * 64 }
    );
  } catch (error) {
    // A repository with no commits yet (no HEAD) makes `git log` exit non-zero.
    // Treat that the same as "no activity in range" rather than failing collection.
    if (isNoCommitsYetError(error)) return [];
    throw error;
  }

  const records = output.split(RECORD_SEP).map((r) => r.trim()).filter(Boolean);
  const commits: CommitSummary[] = [];

  for (const record of records) {
    const lines = record.split("\n");
    const headerLine = lines[0];
    const [hash, shortHash, date, message] = headerLine.split(FIELD_SEP);
    if (!hash) continue;

    let insertions = 0;
    let deletions = 0;
    const changedFiles: string[] = [];

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const [addedRaw, deletedRaw, filePath] = line.split("\t");
      if (!filePath) continue;
      if (isExcluded(filePath, options.excludePathPatterns)) continue;

      changedFiles.push(filePath);
      const added = Number.parseInt(addedRaw, 10);
      const deleted = Number.parseInt(deletedRaw, 10);
      if (Number.isFinite(added)) insertions += added;
      if (Number.isFinite(deleted)) deletions += deleted;
    }

    commits.push({ hash, shortHash, date, message, changedFiles, insertions, deletions });
  }

  return commits;
}

function isExcluded(filePath: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(filePath));
}

function isNoCommitsYetError(error: unknown): boolean {
  const stderr = (error as { stderr?: Buffer | string })?.stderr;
  const text = typeof stderr === "string" ? stderr : stderr?.toString("utf-8");
  return Boolean(text?.includes("does not have any commits yet"));
}
