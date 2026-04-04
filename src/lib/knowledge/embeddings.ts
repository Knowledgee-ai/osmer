import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Use OpenRouter for embeddings (supports text-embedding-3-small)
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
});

export async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openrouter.embedding('openai/text-embedding-3-small'),
    value: text,
  });
  return embedding;
}
