import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { getModel } from './models';

// ============================================================
// Provider Instances
// ============================================================

// OpenRouter — routes to any model through a single API
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
});

// Direct providers (used when API keys are available for lower latency)
const openai = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const google = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
  : null;

// xAI uses OpenAI-compatible API
const xai = process.env.XAI_API_KEY
  ? createOpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })
  : null;

// ============================================================
// Model Router
// ============================================================

/**
 * Routes a model ID to the appropriate AI SDK provider instance.
 *
 * Strategy:
 * 1. If a direct API key exists for the provider, use it (lower latency, no middleman)
 * 2. Fall back to OpenRouter (works for any model)
 *
 * Model IDs follow the format: "provider/model-name"
 * e.g., "openai/gpt-4o", "anthropic/claude-sonnet-4-20250514"
 */
export function getLanguageModel(modelId: string): LanguageModel {
  const model = getModel(modelId);
  if (!model) {
    // If we don't recognize the model, try OpenRouter as a passthrough
    return openrouter(modelId);
  }

  const [provider, ...rest] = modelId.split('/');
  const modelName = rest.join('/'); // Handle models with / in their name

  switch (provider) {
    case 'openai':
      if (openai) return openai(modelName);
      break;
    case 'anthropic':
      if (anthropic) return anthropic(modelName);
      break;
    case 'google':
      if (google) return google(modelName);
      break;
    case 'xai':
      if (xai) return xai(modelName);
      break;
  }

  // Fallback: route through OpenRouter
  // OpenRouter uses the same provider/model format
  return openrouter(modelId);
}

/**
 * Check which providers have direct API keys configured.
 * Used in the UI to show provider status.
 */
export function getAvailableProviders(): Record<string, boolean> {
  return {
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    xai: !!process.env.XAI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };
}

/**
 * Estimate the cost of a request based on token counts.
 */
export function estimateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number
): number {
  const model = getModel(modelId);
  if (!model) return 0;

  const inputCost = (tokensIn / 1_000_000) * model.inputCostPer1M;
  const outputCost = (tokensOut / 1_000_000) * model.outputCostPer1M;
  return inputCost + outputCost;
}
