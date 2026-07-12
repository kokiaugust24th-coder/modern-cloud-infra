import Anthropic from "@anthropic-ai/sdk";
import type { LlmConfig } from "../../config.js";
import { withRetry, type LlmClient, type LlmCompletionParams, type LlmCompletionResult } from "../llm.js";

/** Anthropic-backed client with bounded retries (exponential backoff) and a hard timeout. */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly config: LlmConfig) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    return withRetry({ maxRetries: this.config.maxRetries, baseBackoffMs: this.config.baseBackoffMs }, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await this.client.messages.create(
          {
            model: this.config.model,
            max_tokens: params.maxTokens,
            system: params.system,
            messages: [{ role: "user", content: params.prompt }],
          },
          { signal: controller.signal }
        );

        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n");

        return {
          text,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } finally {
        clearTimeout(timer);
      }
    });
  }
}
