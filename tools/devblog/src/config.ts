import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type LlmProvider = "anthropic" | "openai-compatible";

export interface LlmConfig {
  /** Selects which LlmClient implementation to instantiate (src/generate/providers/factory.ts). */
  provider: LlmProvider;
  model: string;
  /** Required when provider is "openai-compatible" (e.g. https://api.z.ai/api/paas/v4). */
  baseUrl?: string;
  /** Env var name holding the API key. Kept provider-agnostic so switching providers is a config-only change. */
  apiKeyEnvVar: string;
  maxRetries: number;
  baseBackoffMs: number;
  timeoutMs: number;
}

export interface LinterConfig {
  minBodyChars: number;
  maxBodyChars: number;
  requiredFrontmatter: string[];
}

export interface DevblogConfig {
  targetRepoRoot: string;
  openspecChangesDir: string;
  devlogDir: string;
  digestDir: string;
  draftsDir: string;
  ledgerPath: string;
  allowlistPath: string;
  defaultPeriodDays: number;
  excludePathPatterns: string[];
  publishRepoEnvVar: string;
  publishRepoTokenEnvVar: string;
  llm: LlmConfig;
  linter: LinterConfig;
}

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function loadConfig(configPath?: string): DevblogConfig {
  const resolvedPath = configPath ?? path.join(packageRoot, "devblog.config.json");
  const raw = readFileSync(resolvedPath, "utf-8");
  const parsed = JSON.parse(raw) as DevblogConfig;
  return resolveRelativePaths(parsed, path.dirname(resolvedPath));
}

function resolveRelativePaths(config: DevblogConfig, baseDir: string): DevblogConfig {
  return {
    ...config,
    targetRepoRoot: path.resolve(baseDir, config.targetRepoRoot),
    openspecChangesDir: path.resolve(baseDir, config.openspecChangesDir),
    devlogDir: path.resolve(baseDir, config.devlogDir),
    digestDir: path.resolve(baseDir, config.digestDir),
    draftsDir: path.resolve(baseDir, config.draftsDir),
    ledgerPath: path.resolve(baseDir, config.ledgerPath),
    allowlistPath: path.resolve(baseDir, config.allowlistPath),
  };
}
