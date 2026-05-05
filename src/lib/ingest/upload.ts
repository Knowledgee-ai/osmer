import { put } from '@vercel/blob';
import { db } from '@/lib/db';
import { ingestionJobs } from '@/lib/db/schema';
import { withTenant } from '@/lib/db/tenant';

/**
 * Upload a file to Vercel Blob and create an ingestion_jobs row.
 * Returns the job id; the caller (or a queue consumer) processes it
 * asynchronously via processIngestionJob().
 */
export async function uploadAndQueue(
  orgId: string,
  ownerUserId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<{ jobId: string; blobUrl: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { url } = await put(`orgs/${orgId}/uploads/${Date.now()}-${safeName}`, file.buffer, {
    access: 'public',
    contentType: file.type || 'application/octet-stream',
  });

  const [job] = await withTenant(orgId, async (tx) => {
    return tx.insert(ingestionJobs).values({
      orgId,
      ownerUserId,
      kind: 'upload',
      filename: file.name,
      blobUrl: url,
      mimeType: file.type || 'application/octet-stream',
      byteSize: file.size,
      status: 'queued',
    }).returning({ id: ingestionJobs.id });
  });

  return { jobId: job.id, blobUrl: url };
}
