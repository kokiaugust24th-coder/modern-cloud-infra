import type { LlmConfig } from "../../config.js";
import { withRetry, type LlmClient, type LlmCompletionParams, type LlmCompletionResult } from "../llm.js";

interface ChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Client for any provider exposing an OpenAI-compatible `/chat/completions`
 * endpoint (GLM-5.2 via Z.ai, and most other budget/open-weight providers).
 * Uses the platform `fetch` directly rather than the `openai` SDK to avoid
 * an extra dependency for what is a single JSON POST.
 */
export class OpenAiCompatibleLlmClient implements LlmClient {
  constructor(private readonly apiKey: string, private readonly config: LlmConfig) {
    if (!config.baseUrl) {
      throw new Error('llm.baseUrl is required when llm.provider is "openai-compatible"');
    }
  }

  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    return withRetry({ maxRetries: this.config.maxRetries, baseBackoffMs: this.config.baseBackoffMs }, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.config.model,
            max_tokens: params.maxTokens,
            messages: [
              { role: "system", content: params.system },
              { role: "user", content: params.prompt },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`LLM API returned ${response.status}: ${await response.text()}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const text = data.choices[0]?.message?.content ?? "";

        return {
          text,
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        };
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
