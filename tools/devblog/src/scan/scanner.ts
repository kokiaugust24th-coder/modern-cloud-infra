import { spawnSync } from "node:child_process";
import type { ScanFinding } from "../types.js";
import { SECRET_PATTERNS } from "./patterns.js";

/** The MUST-level deterministic scan. Never depends on network or external binaries. */
export function scanContentDeterministic(content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lines = content.split("\n");

  for (const pattern of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes("g") ? pattern.regex.flags : `${pattern.regex.flags}g`);
    for (const match of content.matchAll(regex)) {
      const index = match.index ?? 0;
      const line = content.slice(0, index).split("\n").length;
      findings.push({
        pattern: pattern.id,
        line,
        excerpt: truncate(lines[line - 1] ?? match[0], 120),
      });
    }
  }

  return findings;
}

/**
 * Best-effort additional layer: if the `gitleaks` binary is available on
 * PATH, run it too and fold in its findings. Absence of the binary is not
 * an error — the deterministic patterns above are the required gate
 * (design.md D4).
 */
export function scanContentWithGitleaks(content: string): ScanFinding[] {
  const result = spawnSync("gitleaks", ["detect", "--no-git", "--source", "-", "--report-format", "json", "--exit-code", "0"], {
    input: content,
    encoding: "utf-8",
  });

  if (result.error || !result.stdout) return [];

  try {
    const report = JSON.parse(result.stdout) as Array<{ RuleID: string; StartLine: number; Match: string }>;
    return report.map((entry) => ({
      pattern: `gitleaks:${entry.RuleID}`,
      line: entry.StartLine,
      excerpt: truncate(entry.Match, 120),
    }));
  } catch {
    return [];
  }
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
