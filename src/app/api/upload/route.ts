import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { uploadAndQueue } from '@/lib/ingest/upload';
import { processIngestionJob } from '@/lib/ingest/process';

export const maxDuration = 300;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB per file

/**
 * POST /api/upload — multipart file upload.
 * For V1 we process synchronously after upload (the function has 300s).
 * Future: enqueue + process via cron / queue consumer.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const [me] = await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!me?.orgId) return Response.json({ error: 'no_org' }, { status: 400 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'too_large', maxBytes: MAX_BYTES }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const out = await uploadAndQueue(me.orgId, session.user.id, {
    name: file.name,
    type: file.type,
    size: file.size,
    buffer: buf,
  });

  // Process inline so the user sees indexed chunks before redirect.
  // Best-effort — failures are recorded to ingestion_jobs.error_message.
  try {
    const result = await processIngestionJob(out.jobId);
    return Response.json({ jobId: out.jobId, blobUrl: out.blobUrl, ...result });
  } catch (err) {
    return Response.json({
      jobId: out.jobId,
      blobUrl: out.blobUrl,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
