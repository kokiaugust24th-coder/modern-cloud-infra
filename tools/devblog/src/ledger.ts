import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { LedgerEntry } from "./types.js";

/** Reads the append-only JSONL publication ledger. Missing file means no history yet. */
export function readLedger(ledgerPath: string): LedgerEntry[] {
  if (!existsSync(ledgerPath)) return [];
  const content = readFileSync(ledgerPath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LedgerEntry);
}

export function appendLedgerEntry(ledgerPath: string, entry: LedgerEntry): void {
  mkdirSync(path.dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf-8");
}

/** Latest `until` timestamp already covered by a published entry, if any. */
export function latestPublishedUntil(entries: LedgerEntry[]): Date | null {
  let latest: Date | null = null;
  for (const entry of entries) {
    const until = new Date(entry.sourcePeriod.until);
    if (!latest || until > latest) latest = until;
  }
  return latest;
}
