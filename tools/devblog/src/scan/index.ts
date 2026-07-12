import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DevblogConfig } from "../config.js";
import type { ScanFinding, ScanResult } from "../types.js";
import { scanContentDeterministic, scanContentWithGitleaks } from "./scanner.js";
import { computeContentHash } from "./hash.js";
import { readAllowlist, isAllowlisted } from "./allowlist.js";

export function runScan(config: DevblogConfig, content: string): ScanResult {
  const allFindings: ScanFinding[] = [
    ...scanContentDeterministic(content),
    ...scanContentWithGitleaks(content),
  ];

  const allowlist = readAllowlist(config.allowlistPath);
  const findings = allFindings.filter((finding) => !isAllowlisted(finding, allowlist));

  const contentHash = computeContentHash(content);

  return {
    passed: findings.length === 0,
    findings,
    contentHash,
  };
}

export function writeScanResult(config: DevblogConfig, slug: string, result: ScanResult): string {
  mkdirSync(config.draftsDir, { recursive: true });
  const resultPath = path.join(config.draftsDir, `${slug}.scan.json`);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");
  return resultPath;
}

/** Detects post-scan tampering: the content at publish time must still hash-match the passed scan. */
export function verifyUnchangedSinceScan(content: string, scanResult: ScanResult): boolean {
  return computeContentHash(content) === scanResult.contentHash;
}
