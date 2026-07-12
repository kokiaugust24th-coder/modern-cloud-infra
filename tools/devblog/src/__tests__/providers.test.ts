import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAiCompatibleLlmClient } from "../generate/providers/openaiCompatible.js";
import { createLlmClient } from "../generate/providers/factory.js";
import { AnthropicLlmClient } from "../generate/providers/anthropic.js";
import type { LlmConfig } from "../config.js";

function makeConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: "openai-compatible",
    model: "glm-5.2",
    baseUrl: "https://api.z.ai/api/paas/v4",
    apiKeyEnvVar: "TEST_LLM_KEY",
    maxRetries: 1,
    baseBackoffMs: 1,
    timeoutMs: 1000,
    ...overrides,
  };
}

describe("OpenAiCompatibleLlmClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("posts an OpenAI-shaped chat completion request and parses usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "生成された記事本文" } }],
        usage: { prompt_tokens: 120, completion_tokens: 340 },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new OpenAiCompatibleLlmClient("test-key", makeConfig());
    const result = await client.complete({ system: "sys", prompt: "user prompt", maxTokens: 500 });

    expect(result.text).toBe("生成された記事本文");
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(340);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("glm-5.2");
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "user prompt" },
    ]);
    // Reasoning models (e.g. GLM-5.2) must not spend max_tokens on chain-of-thought.
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  it("treats an empty completion as a retryable failure instead of returning blank text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }], usage: { prompt_tokens: 10, completion_tokens: 0 } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new OpenAiCompatibleLlmClient("test-key", makeConfig({ maxRetries: 1, baseBackoffMs: 1 }));

    const error = await client.complete({ system: "s", prompt: "p", maxTokens: 10 }).catch((e) => e);
    expect((error as { cause?: Error }).cause?.message).toMatch(/empty completion/);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("retries on failure and eventually throws after exhausting retries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new OpenAiCompatibleLlmClient("test-key", makeConfig({ maxRetries: 2, baseBackoffMs: 1 }));

    await expect(client.complete({ system: "s", prompt: "p", maxTokens: 10 })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("throws immediately if baseUrl is missing", () => {
    expect(() => new OpenAiCompatibleLlmClient("key", makeConfig({ baseUrl: undefined }))).toThrow(/baseUrl/);
  });
});

describe("createLlmClient", () => {
  it("builds an OpenAiCompatibleLlmClient for provider=openai-compatible", () => {
    const client = createLlmClient(makeConfig(), { TEST_LLM_KEY: "abc" } as NodeJS.ProcessEnv);
    expect(client).toBeInstanceOf(OpenAiCompatibleLlmClient);
  });

  it("builds an AnthropicLlmClient for provider=anthropic", () => {
    const client = createLlmClient(
      makeConfig({ provider: "anthropic", baseUrl: undefined, apiKeyEnvVar: "ANTHROPIC_TEST_KEY" }),
      { ANTHROPIC_TEST_KEY: "abc" } as NodeJS.ProcessEnv
    );
    expect(client).toBeInstanceOf(AnthropicLlmClient);
  });

  it("throws a clear error when the configured API key env var is missing", () => {
    expect(() => createLlmClient(makeConfig(), {} as NodeJS.ProcessEnv)).toThrow(/TEST_LLM_KEY/);
  });
});
