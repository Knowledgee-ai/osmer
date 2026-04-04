import type { Model } from '@/types';

// ============================================================
// Available Models Registry
// ============================================================

export const AVAILABLE_MODELS: Model[] = [
  // OpenAI
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    inputCostPer1M: 2.50,
    outputCostPer1M: 10.00,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    supportsStreaming: true,
    supportsVision: true,
    category: 'mini',
  },
  {
    id: 'openai/o3-mini',
    name: 'o3-mini',
    provider: 'openai',
    contextWindow: 200000,
    inputCostPer1M: 1.10,
    outputCostPer1M: 4.40,
    supportsStreaming: true,
    supportsVision: false,
    category: 'fast',
  },
  // Anthropic
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  {
    id: 'anthropic/claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    inputCostPer1M: 0.80,
    outputCostPer1M: 4.00,
    supportsStreaming: true,
    supportsVision: true,
    category: 'fast',
  },
  {
    id: 'anthropic/claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 1000000,
    inputCostPer1M: 15.00,
    outputCostPer1M: 75.00,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // Google
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    contextWindow: 1000000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.60,
    supportsStreaming: true,
    supportsVision: true,
    category: 'fast',
  },
  // xAI
  {
    id: 'xai/grok-3',
    name: 'Grok 3',
    provider: 'xai',
    contextWindow: 131072,
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // Meta (via OpenRouter)
  {
    id: 'meta/llama-4-maverick',
    name: 'Llama 4 Maverick',
    provider: 'meta',
    contextWindow: 1000000,
    inputCostPer1M: 0.20,
    outputCostPer1M: 0.60,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
];

export const MODEL_MAP = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));

export function getModel(id: string): Model | undefined {
  return MODEL_MAP.get(id);
}

export function getModelsByProvider(provider: string): Model[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider);
}

export function getModelsByCategory(category: Model['category']): Model[] {
  return AVAILABLE_MODELS.filter(m => m.category === category);
}

// Group models by provider for the UI selector
export function getModelsGroupedByProvider(): Record<string, Model[]> {
  const grouped: Record<string, Model[]> = {};
  for (const model of AVAILABLE_MODELS) {
    const providerName = PROVIDER_NAMES[model.provider] || model.provider;
    if (!grouped[providerName]) grouped[providerName] = [];
    grouped[providerName].push(model);
  }
  return grouped;
}

export const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  meta: 'Meta',
  openrouter: 'OpenRouter',
};

export const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  xai: '#000000',
  meta: '#0668E1',
};
