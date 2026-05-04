import { db } from "@/lib/db";
import { conversations, conversationParticipants, users } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

export interface ConversationAccess {
  conversation: {
    id: string;
    ownerId: string;
    orgId: string | null;
    visibility: 'private' | 'team' | 'organization';
    teamId: string | null;
  };
  isOwner: boolean;
  isParticipant: boolean;
  isOrgMember: boolean;
}

/**
 * Resolve whether the given user can read/write the conversation.
 * Reading is permitted if the user is the owner, an explicit participant,
 * or the conversation is visibility=organization and the user is in the
 * same org. Writing currently piggybacks on read for any non-private
 * conversation; private conversations require ownership.
 */
export async function getConversationAccess(
  conversationId: string,
  userId: string
): Promise<ConversationAccess | null> {
  const [conv] = await db
    .select({
      id: conversations.id,
      ownerId: conversations.userId,
      orgId: conversations.orgId,
      visibility: conversations.visibility,
      teamId: conversations.teamId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) return null;

  const isOwner = conv.ownerId === userId;

  if (isOwner) {
    return {
      conversation: conv,
      isOwner: true,
      isParticipant: true,
      isOrgMember: true,
    };
  }

  // Check participant membership
  const [participant] = await db
    .select({ id: conversationParticipants.id })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conv.id),
        eq(conversationParticipants.userId, userId)
      )
    )
    .limit(1);
  const isParticipant = Boolean(participant);

  // Check same-org membership for organization-visibility conversations
  let isOrgMember = false;
  if (conv.visibility === 'organization' && conv.orgId) {
    const [u] = await db
      .select({ orgId: users.orgId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    isOrgMember = Boolean(u?.orgId && u.orgId === conv.orgId);
  }

  return {
    conversation: conv,
    isOwner: false,
    isParticipant,
    isOrgMember,
  };
}

/** True if the user can read messages in this conversation. */
export function canRead(access: ConversationAccess | null): boolean {
  if (!access) return false;
  return access.isOwner || access.isParticipant || access.isOrgMember;
}

/** True if the user can post messages in this conversation. */
export function canWrite(access: ConversationAccess | null): boolean {
  if (!access) return false;
  if (access.isOwner) return true;
  if (access.conversation.visibility === 'private') return false;
  return access.isParticipant || access.isOrgMember;
}

/**
 * SQL fragment for the conversation list query: matches conversations
 * the user owns, participates in, or that are org-public in their org.
 */
export function conversationListFilter(userId: string, userOrgId: string | null) {
  const ownerMatch = eq(conversations.userId, userId);
  const orgMatch = userOrgId
    ? and(eq(conversations.visibility, 'organization'), eq(conversations.orgId, userOrgId))
    : undefined;
  // Participants are joined separately and filtered in the calling query.
  return orgMatch ? or(ownerMatch, orgMatch) : ownerMatch;
}
