import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { saveKnowledgeAtomToDb } from '@/lib/knowledge/db-store';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '@/lib/ai/router';

export const maxDuration = 30;

// POST /api/integrations/slack — receive Slack webhook events
export async function POST(req: Request) {
  const body = await req.json();

  // Handle Slack URL verification challenge
  if (body.type === 'url_verification') {
    return Response.json({ challenge: body.challenge });
  }

  // Handle message events
  if (body.event?.type === 'message' && !body.event?.bot_id) {
    const { text, user: slackUserId, channel } = body.event;

    if (!text || text.length < 20) {
      return Response.json({ ok: true }); // Skip short messages
    }

    // Find the Osmer user linked to this Slack workspace
    // For now, use a simple token-based auth via query param or header
    const apiKey = req.headers.get('x-osmer-key');
    if (!apiKey) {
      return Response.json({ ok: true }); // Silently ignore if no key
    }

    // Look up user by API key (stored in user preferences)
    const userResult = await db.execute(
      sql`SELECT id FROM users WHERE preferences->>'slackApiKey' = ${apiKey} LIMIT 1`
    );

    if (userResult.rows.length === 0) {
      return Response.json({ ok: true });
    }

    const userId = (userResult.rows[0] as { id: string }).id;

    // Extract knowledge from the Slack message
    const extractionModel = process.env.EXTRACTION_MODEL || 'anthropic/claude-haiku-4-5-20251001';
    const model = getLanguageModel(extractionModel);

    try {
      const result = await generateObject({
        model,
        schema: z.object({
          atoms: z.array(z.object({
            type: z.enum(['fact', 'decision', 'preference', 'solution', 'relationship', 'process', 'context']),
            content: z.string(),
            confidence: z.number(),
            topics: z.array(z.string()),
            entities: z.array(z.string()),
          })),
        }),
        prompt: `Extract reusable knowledge from this Slack message. Only extract if there's meaningful organizational knowledge. Return empty array if nothing worth capturing.

Message from channel ${channel}: ${text}`,
      });

      for (const atom of result.object.atoms) {
        await saveKnowledgeAtomToDb({
          ...atom,
          sourceConversationId: `slack-${channel}`,
          extractedBy: extractionModel,
          userId,
        });
      }
    } catch {
      // Extraction failure is non-fatal
    }
  }

  return Response.json({ ok: true });
}
