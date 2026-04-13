import type { ModelInfo, ProviderConfig } from "@/types/settings";

/** All known providers with their default configuration */
export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: "openai", name: "OpenAI", apiKey: "", enabled: true },
  { id: "anthropic", name: "Anthropic", apiKey: "", enabled: false },
  { id: "openrouter", name: "OpenRouter", apiKey: "", enabled: false },
  { id: "minimax", name: "Minimax", apiKey: "", enabled: false },
  { id: "minimax-code", name: "Minimax Code", apiKey: "", enabled: false },
  { id: "zai", name: "Zai (Zhipu AI)", apiKey: "", enabled: false },
  { id: "zai-code", name: "Zai Code", apiKey: "", enabled: false },
  { id: "kimi", name: "Kimi (Moonshot)", apiKey: "", enabled: false },
  { id: "kimi-code", name: "Kimi for Coding", apiKey: "", enabled: false },
  { id: "requesty", name: "Requesty", apiKey: "", enabled: false },
];

/** Known models per provider */
export const KNOWN_MODELS: ModelInfo[] = [
  // OpenAI
  { id: "gpt-4o", name: "GPT-4o", providerId: "openai", contextWindow: 128_000 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", providerId: "openai", contextWindow: 128_000 },
  { id: "gpt-4.1", name: "GPT-4.1", providerId: "openai", contextWindow: 1_000_000 },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", providerId: "openai", contextWindow: 1_000_000 },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", providerId: "openai", contextWindow: 1_000_000 },
  { id: "o3-mini", name: "o3-mini", providerId: "openai", contextWindow: 200_000 },
  { id: "o4-mini", name: "o4-mini", providerId: "openai", contextWindow: 200_000 },

  // Anthropic
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", providerId: "anthropic", contextWindow: 200_000 },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", providerId: "anthropic", contextWindow: 200_000 },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", providerId: "anthropic", contextWindow: 200_000 },

  // Minimax (Anthropic Messages API)
  { id: "MiniMax-M2.7", name: "MiniMax M2.7", providerId: "minimax", contextWindow: 204_800 },
  { id: "MiniMax-M2.5", name: "MiniMax M2.5", providerId: "minimax", contextWindow: 196_608 },
  { id: "MiniMax-M2.7-highspeed", name: "MiniMax M2.7 Highspeed", providerId: "minimax", contextWindow: 204_800 },
  { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 Highspeed", providerId: "minimax", contextWindow: 196_608 },

  // Minimax Code
  { id: "MiniMax-M2.7", name: "MiniMax M2.7", providerId: "minimax-code", contextWindow: 204_800 },
  { id: "MiniMax-M2.5", name: "MiniMax M2.5", providerId: "minimax-code", contextWindow: 196_608 },

  // Zai / Zhipu AI (OpenAI Chat Completions)
  { id: "glm-5.1", name: "GLM-5.1", providerId: "zai", contextWindow: 200_000 },
  { id: "glm-5", name: "GLM-5", providerId: "zai", contextWindow: 200_000 },
  { id: "glm-5-turbo", name: "GLM-5 Turbo", providerId: "zai", contextWindow: 200_000 },
  { id: "glm-4.7", name: "GLM-4.7", providerId: "zai", contextWindow: 200_000 },
  { id: "glm-4.5-flash", name: "GLM-4.5 Flash", providerId: "zai", contextWindow: 128_000 },

  // Zai Code
  { id: "glm-5.1", name: "GLM-5.1", providerId: "zai-code", contextWindow: 200_000 },
  { id: "glm-5-turbo", name: "GLM-5 Turbo", providerId: "zai-code", contextWindow: 200_000 },

  // Kimi / Moonshot AI
  { id: "kimi-k2.5", name: "Kimi K2.5", providerId: "kimi", contextWindow: 256_000 },
  { id: "kimi-k2-thinking", name: "Kimi K2 Thinking", providerId: "kimi", contextWindow: 128_000 },
  { id: "kimi-k2-thinking-turbo", name: "Kimi K2 Thinking Turbo", providerId: "kimi", contextWindow: 128_000 },
  { id: "moonshot-v1-auto", name: "Moonshot V1 Auto", providerId: "kimi", contextWindow: 128_000 },

  // OpenRouter (pass-through, provider/model format)
  { id: "openai/gpt-4o", name: "GPT-4o", providerId: "openrouter", contextWindow: 128_000 },
  { id: "openai/gpt-4.1", name: "GPT-4.1", providerId: "openrouter", contextWindow: 1_000_000 },
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", providerId: "openrouter", contextWindow: 200_000 },
  { id: "anthropic/claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", providerId: "openrouter", contextWindow: 200_000 },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", providerId: "openrouter", contextWindow: 1_000_000 },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", providerId: "openrouter", contextWindow: 1_000_000 },
  { id: "deepseek/deepseek-chat-v3-0324", name: "DeepSeek V3", providerId: "openrouter", contextWindow: 128_000 },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", providerId: "openrouter", contextWindow: 1_000_000 },

  // Requesty (pass-through, provider/model format)
  { id: "openai/gpt-4o", name: "GPT-4o", providerId: "requesty", contextWindow: 128_000 },
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", providerId: "requesty", contextWindow: 200_000 },
];

/** Format a token count for display (e.g. 128000 → "128K", 1000000 → "1M") */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  const k = tokens / 1_000;
  return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
}

/** Get the provider ID for a given model (checks KNOWN_MODELS only) */
export function getProviderForModel(modelId: string): string | undefined {
  return KNOWN_MODELS.find((m) => m.id === modelId)?.providerId;
}

/** Parse a "providerId/modelId" slug into its parts */
export function parseModelSlug(slug: string, allModels?: ModelInfo[]): { providerId: string; modelId: string } {
  const idx = slug.indexOf("/");
  if (idx >= 0) {
    return { providerId: slug.slice(0, idx), modelId: slug.slice(idx + 1) };
  }
  // Legacy format: bare model ID, try to resolve provider
  // Check the full model list (including registry models) if provided
  if (allModels) {
    const found = allModels.find((m) => m.id === slug);
    if (found) {
      return { providerId: found.providerId, modelId: slug };
    }
  }
  const providerId = getProviderForModel(slug);
  return { providerId: providerId ?? "openai", modelId: slug };
}

/** Create a "providerId/modelId" slug */
export function makeModelSlug(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}
