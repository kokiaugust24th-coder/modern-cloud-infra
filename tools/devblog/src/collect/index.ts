import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DevblogConfig } from "../config.js";
import { readLedger, latestPublishedUntil } from "../ledger.js";
import type { Digest } from "../types.js";
import { collectCommits } from "./git.js";
import { collectOpenSpecChanges } from "./openspec.js";
import { collectDevlogEntries } from "./devlog.js";

export interface CollectArgs {
  /** ISO date string. Defaults to config.defaultPeriodDays before `until`, or the last published `until` if more recent. */
  since?: string;
  /** ISO date string. Defaults to now. */
  until?: string;
  /** Ignore the publication ledger and collect the full requested period regardless of prior publications. */
  force?: boolean;
}

export interface CollectResult {
  digest: Digest;
  digestPath: string | null;
}

export function runCollect(config: DevblogConfig, args: CollectArgs = {}): CollectResult {
  const until = args.until ? new Date(args.until) : new Date();
  let since = args.since
    ? new Date(args.since)
    : new Date(until.getTime() - config.defaultPeriodDays * 24 * 60 * 60 * 1000);

  if (!args.force && !args.since) {
    const ledger = readLedger(config.ledgerPath);
    const lastUntil = latestPublishedUntil(ledger);
    if (lastUntil && lastUntil > since) {
      since = lastUntil;
    }
  }

  const excludePathPatterns = config.excludePathPatterns.map((p) => new RegExp(p));

  const commits = collectCommits({
    repoRoot: config.targetRepoRoot,
    since: since.toISOString(),
    until: until.toISOString(),
    excludePathPatterns,
  });

  const openspecChanges = collectOpenSpecChanges({
    changesDir: config.openspecChangesDir,
    since,
    until,
  });

  const devlogEntries = collectDevlogEntries({
    devlogDir: config.devlogDir,
    since,
    until,
  });

  const isEmpty = commits.length === 0 && openspecChanges.length === 0;

  const digest: Digest = {
    period: { since: since.toISOString(), until: until.toISOString() },
    generatedAt: new Date().toISOString(),
    commits,
    openspecChanges,
    devlogEntries,
    isEmpty,
  };

  let digestPath: string | null = null;
  if (!isEmpty) {
    mkdirSync(config.digestDir, { recursive: true });
    const fileName = `digest-${until.toISOString().replace(/[:.]/g, "-")}.json`;
    digestPath = path.join(config.digestDir, fileName);
    writeFileSync(digestPath, JSON.stringify(digest, null, 2), "utf-8");
  }

  return { digest, digestPath };
}
