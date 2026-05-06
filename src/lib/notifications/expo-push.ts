import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { devices } from '@/lib/db/schema';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to every device registered to a user.
 * Uses the Expo Push Service. Best-effort — a failure here should
 * never block the calling code path (e.g., agent run completion).
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<void> {
  const list = await db.select().from(devices).where(eq(devices.userId, userId));
  if (list.length === 0) return;

  const messages = list.map((d) => ({
    to: d.expoPushToken,
    sound: 'default' as const,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[push] send failed:', err instanceof Error ? err.message : err);
  }
}
