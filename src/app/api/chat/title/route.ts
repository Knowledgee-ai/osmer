import { generateText } from 'ai';
import { getLanguageModel } from '@/lib/ai/router';

export const maxDuration = 10;

export async function POST(req: Request) {
  const { userMessage, aiResponse } = await req.json() as {
    userMessage: string;
    aiResponse: string;
  };

  const extractionModelId = process.env.EXTRACTION_MODEL || 'anthropic/claude-haiku-4-5-20251001';
  const model = getLanguageModel(extractionModelId);

  try {
    const result = await generateText({
      model,
      prompt: `Generate a very short title (3-6 words, no quotes) for this conversation:

User: ${userMessage.slice(0, 200)}
Assistant: ${aiResponse.slice(0, 200)}

Title:`,
      maxOutputTokens: 20,
    });

    const title = result.text.trim().replace(/^["']|["']$/g, '').slice(0, 60);
    return Response.json({ title });
  } catch {
    return Response.json({ title: null });
  }
}
