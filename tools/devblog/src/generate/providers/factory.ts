import type { LlmConfig } from "../../config.js";
import type { LlmClient } from "../llm.js";
import { AnthropicLlmClient } from "./anthropic.js";
import { OpenAiCompatibleLlmClient } from "./openaiCompatible.js";

/**
 * Instantiates the configured provider. This is the single place that
 * switches on `llm.provider` — adding a new provider means adding one case
 * here plus a client class, never touching the generation pipeline itself.
 */
export function createLlmClient(config: LlmConfig, env: NodeJS.ProcessEnv = process.env): LlmClient {
  const apiKey = env[config.apiKeyEnvVar];
  if (!apiKey) {
    throw new Error(`${config.apiKeyEnvVar} が設定されていません。`);
  }

  switch (config.provider) {
    case "anthropic":
      return new AnthropicLlmClient(apiKey, config);
    case "openai-compatible":
      return new OpenAiCompatibleLlmClient(apiKey, config);
    default: {
      const exhaustiveCheck: never = config.provider;
      throw new Error(`未知の LLM プロバイダです: ${exhaustiveCheck}`);
    }
  }
}
