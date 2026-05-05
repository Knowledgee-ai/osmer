import { embed as aiEmbed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export const EMBEDDING_DIM = 1536;
export const currentEmbeddingVersion = 1;

const EMBEDDING_MODEL_BY_VERSION: Record<number, string> = {
  1: 'openai/text-embedding-3-small',
};

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  baseURL: 'https://openrouter.ai/api/v1',
});

export interface EmbedResult {
  vector: number[];
  version: number;
}

export async function embed(text: string, version: number = currentEmbeddingVersion): Promise<EmbedResult> {
  const modelId = EMBEDDING_MODEL_BY_VERSION[version];
  if (!modelId) throw new Error(`unknown embedding version ${version}`);
  const { embedding } = await aiEmbed({
    model: openrouter.embedding(modelId),
    value: text.slice(0, 8000),
  });
  return { vector: embedding, version };
}

export async function embedBatch(texts: string[]): Promise<EmbedResult[]> {
  return Promise.all(texts.map((t) => embed(t)));
}
