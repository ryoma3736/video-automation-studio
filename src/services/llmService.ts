/**
 * LLM Service
 * Handles interactions with LLM providers (OpenAI, Anthropic)
 */

import { logger } from "../utils/logger";

export type LLMProvider = "openai" | "anthropic";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Default LLM configurations
 */
const DEFAULT_CONFIGS: Record<LLMProvider, { model: string; temperature: number; maxTokens: number }> = {
  openai: {
    model: "gpt-4-turbo-preview",
    temperature: 0.7,
    maxTokens: 4000,
  },
  anthropic: {
    model: "claude-3-sonnet-20240229",
    temperature: 0.7,
    maxTokens: 4096,
  },
};

/**
 * Get LLM configuration from environment variables
 */
export function getLLMConfigFromEnv(): LLMConfig | null {
  // Check for OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || DEFAULT_CONFIGS.openai.model,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "4000", 10),
    };
  }

  // Check for Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || DEFAULT_CONFIGS.anthropic.model,
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || "0.7"),
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || "4096", 10),
    };
  }

  return null;
}

/**
 * LLM Client interface
 */
export interface LLMClient {
  complete(prompt: string): Promise<string>;
}

/**
 * OpenAI Client implementation
 */
class OpenAIClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async complete(prompt: string): Promise<string> {
    const model = this.config.model || DEFAULT_CONFIGS.openai.model;
    const temperature = this.config.temperature || DEFAULT_CONFIGS.openai.temperature;
    const maxTokens = this.config.maxTokens || DEFAULT_CONFIGS.openai.maxTokens;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const error = errorData as { error?: { message?: string } };
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content || "";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("OpenAI API request failed", { error: message });
      throw error;
    }
  }
}

/**
 * Anthropic Client implementation
 */
class AnthropicClient implements LLMClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async complete(prompt: string): Promise<string> {
    const model = this.config.model || DEFAULT_CONFIGS.anthropic.model;
    const temperature = this.config.temperature || DEFAULT_CONFIGS.anthropic.temperature;
    const maxTokens = this.config.maxTokens || DEFAULT_CONFIGS.anthropic.maxTokens;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        const error = errorData as { error?: { message?: string } };
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json() as { content?: Array<{ text?: string }> };
      return data.content?.[0]?.text || "";
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Anthropic API request failed", { error: message });
      throw error;
    }
  }
}

/**
 * Create LLM client from configuration
 */
export function createLLMClient(config?: LLMConfig): LLMClient {
  const effectiveConfig = config || getLLMConfigFromEnv();

  if (!effectiveConfig) {
    throw new Error(
      "LLM configuration not found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable."
    );
  }

  switch (effectiveConfig.provider) {
    case "openai":
      return new OpenAIClient(effectiveConfig);
    case "anthropic":
      return new AnthropicClient(effectiveConfig);
    default:
      throw new Error(`Unsupported LLM provider: ${effectiveConfig.provider}`);
  }
}

/**
 * Default LLM client (singleton pattern)
 */
let defaultClient: LLMClient | null = null;

export function getDefaultLLMClient(): LLMClient {
  if (!defaultClient) {
    defaultClient = createLLMClient();
  }
  return defaultClient;
}

/**
 * Reset default client (useful for testing)
 */
export function resetDefaultLLMClient(): void {
  defaultClient = null;
}
