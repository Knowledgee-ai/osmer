import type { Model } from '@/types';

// ============================================================
// Available Models Registry
// ============================================================
//
// Curated list — ten frontier models across nine providers, ordered
// by why they earn the slot:
//
//   1  Opus 4.7        — best answer for hard reasoning
//   2  Sonnet 4.6      — agentic workhorse, 1M context, much cheaper
//   3  GPT-5.5         — OpenAI flagship, brand parity
//   4  GPT-5.5 Pro     — deep-reasoning variant for analysis
//   5  Gemini 3.1 Pro  — 1M context + native multimodal
//   6  Gemini 3 Flash  — cost-efficient frontier (retrieval, summarisation)
//   7  DeepSeek V4 Pro — open-weight value frontier
//   8  Kimi K2.6       — agentic-swarm specialist
//   9  Qwen 3.6-Max    — code-on-knowledge tasks
//  10  Grok 4          — real-time / X-native data
//
// Unknown-to-router providers (DeepSeek / Moonshot / Alibaba) fall
// through to OpenRouter automatically — see src/lib/ai/router.ts.

export const AVAILABLE_MODELS: Model[] = [
  // 1. Anthropic — top of SWE-Bench Pro, best for hard reasoning
  {
    id: 'anthropic/claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    contextWindow: 1_000_000,
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // 2. Anthropic — agentic workhorse
  {
    id: 'anthropic/claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 1_000_000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // 3. OpenAI — flagship
  {
    id: 'openai/gpt-5.5',
    name: 'GPT-5.5',
    provider: 'openai',
    contextWindow: 400_000,
    inputCostPer1M: 5.0,
    outputCostPer1M: 15.0,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // 4. OpenAI — deep-reasoning variant
  {
    id: 'openai/gpt-5.5-pro',
    name: 'GPT-5.5 Pro',
    provider: 'openai',
    contextWindow: 400_000,
    inputCostPer1M: 15.0,
    outputCostPer1M: 60.0,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // 5. Google — 1M context + multimodal
  {
    id: 'google/gemini-3.1-pro',
    name: 'Gemini 3.1 Pro',
    provider: 'google',
    contextWindow: 1_000_000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
  // 6. Google — cost-efficient frontier
  {
    id: 'google/gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'google',
    contextWindow: 1_000_000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsStreaming: true,
    supportsVision: true,
    category: 'fast',
  },
  // 7. DeepSeek — open-weight value frontier
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    contextWindow: 1_000_000,
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
    supportsStreaming: true,
    supportsVision: false,
    category: 'flagship',
  },
  // 8. Moonshot — agentic-swarm specialist
  {
    id: 'moonshotai/kimi-k2.6',
    name: 'Kimi K2.6',
    provider: 'moonshot',
    contextWindow: 200_000,
    inputCostPer1M: 1.0,
    outputCostPer1M: 3.0,
    supportsStreaming: true,
    supportsVision: false,
    category: 'flagship',
  },
  // 9. Alibaba — code-on-knowledge specialist
  {
    id: 'qwen/qwen-3.6-max-preview',
    name: 'Qwen 3.6 Max Preview',
    provider: 'alibaba',
    contextWindow: 256_000,
    inputCostPer1M: 1.0,
    outputCostPer1M: 3.0,
    supportsStreaming: true,
    supportsVision: false,
    category: 'flagship',
  },
  // 10. xAI — real-time / X-native data
  {
    id: 'xai/grok-4',
    name: 'Grok 4',
    provider: 'xai',
    contextWindow: 256_000,
    inputCostPer1M: 5.0,
    outputCostPer1M: 15.0,
    supportsStreaming: true,
    supportsVision: true,
    category: 'flagship',
  },
];

export const MODEL_MAP = new Map(AVAILABLE_MODELS.map(m => [m.id, m]));

export const DEFAULT_MODEL_ID = 'anthropic/claude-opus-4-7';

export function getModel(id: string): Model | undefined {
  return MODEL_MAP.get(id);
}

export function getModelsByProvider(provider: string): Model[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider);
}

export function getModelsByCategory(category: Model['category']): Model[] {
  return AVAILABLE_MODELS.filter(m => m.category === category);
}

// Group models by provider for the UI selector — preserves the curated
// order above by inserting providers as we encounter them.
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
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot',
  alibaba: 'Alibaba',
  openrouter: 'OpenRouter',
};

export const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  xai: '#1a1814',
  meta: '#0668e1',
  deepseek: '#4d6bfe',
  moonshot: '#7b3fe4',
  alibaba: '#ff6a00',
};
