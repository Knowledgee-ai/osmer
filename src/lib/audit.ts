import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

type AuditAction =
  | 'user.register'
  | 'user.login'
  | 'conversation.create'
  | 'conversation.delete'
  | 'message.send'
  | 'knowledge.extract'
  | 'knowledge.delete'
  | 'knowledge.promote'
  | 'knowledge.reconcile'
  | 'team.create'
  | 'team.invite'
  | 'data.export'
  | 'settings.update';

type ResourceType = 'user' | 'conversation' | 'message' | 'knowledge' | 'team' | 'settings' | 'export';

export async function logAudit(
  userId: string | null,
  action: AuditAction,
  resourceType: ResourceType,
  resourceId?: string,
  details?: Record<string, unknown>
) {
  try {
    await db.execute(
      sql`INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
        VALUES (${userId}, ${action}, ${resourceType}, ${resourceId || null}, ${JSON.stringify(details || {})}::jsonb)`
    );
  } catch {
    // Audit logging is best-effort — never block the main operation
  }
}
