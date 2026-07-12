export interface LlmCompletionParams {
  system: string;
  prompt: string;
  maxTokens: number;
}

export interface LlmCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Provider-agnostic completion interface. Every provider client
 * (src/generate/providers/*) implements this so the generation pipeline
 * (stages.ts) never depends on a specific vendor — switching models is a
 * `devblog.config.json` change, not a code change.
 */
export interface LlmClient {
  complete(params: LlmCompletionParams): Promise<LlmCompletionResult>;
}

export class LlmCallError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LlmCallError";
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseBackoffMs: number;
}

/** Shared bounded-retry-with-exponential-backoff wrapper used by every provider client. */
export async function withRetry<T>(config: RetryConfig, attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attemptIndex = 0; attemptIndex <= config.maxRetries; attemptIndex++) {
    if (attemptIndex > 0) {
      await sleep(config.baseBackoffMs * 2 ** (attemptIndex - 1));
    }

    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw new LlmCallError(`LLM call failed after ${config.maxRetries + 1} attempts`, lastError);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
