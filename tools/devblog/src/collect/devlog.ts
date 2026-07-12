import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DevlogEntry } from "../types.js";

const DATE_FILENAME = /^(\d{4}-\d{2}-\d{2})\.md$/;
const URL_PATTERN = /https?:\/\/[^\s)\]]+/g;

export interface DevlogCollectOptions {
  devlogDir: string;
  since: Date;
  until: Date;
}

/** Collects developer notes. Absence of any files is not an error. */
export function collectDevlogEntries(options: DevlogCollectOptions): DevlogEntry[] {
  let files: string[];
  try {
    files = readdirSync(options.devlogDir);
  } catch {
    return [];
  }

  const entries: DevlogEntry[] = [];
  const sinceDay = toDayString(options.since);
  const untilDay = toDayString(options.until);

  for (const fileName of files) {
    const match = fileName.match(DATE_FILENAME);
    if (!match) continue;

    // Devlog entries carry day-level granularity only; compare by calendar
    // day (inclusive) rather than exact timestamps so a note written earlier
    // today isn't excluded by a `since` cutoff later in the same day.
    if (match[1] < sinceDay || match[1] > untilDay) continue;

    const fullPath = path.join(options.devlogDir, fileName);
    const body = readFileSync(fullPath, "utf-8");
    const { referenceUrls, embedCandidateUrls } = extractUrls(body);

    entries.push({
      date: match[1],
      sourcePath: fileName,
      body,
      referenceUrls,
      embedCandidateUrls,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function extractUrls(body: string): { referenceUrls: string[]; embedCandidateUrls: string[] } {
  const referenceSection = extractSection(body, "参照");
  const embedSection = extractSection(body, "埋め込み候補");
  return {
    referenceUrls: referenceSection.match(URL_PATTERN) ?? [],
    embedCandidateUrls: embedSection.match(URL_PATTERN) ?? [],
  };
}

function toDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`);
  return pattern.exec(body)?.[1] ?? "";
}
