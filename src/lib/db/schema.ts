import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  real,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// Enums
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['owner', 'admin', 'member']);
export const planEnum = pgEnum('plan', ['free', 'pro', 'team', 'business', 'enterprise']);
export const teamRoleEnum = pgEnum('team_role', ['lead', 'member']);
export const conversationVisibilityEnum = pgEnum('conversation_visibility', ['private', 'team', 'organization']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);
export const knowledgeTypeEnum = pgEnum('knowledge_type', ['fact', 'decision', 'preference', 'solution', 'relationship', 'process', 'context']);
export const knowledgeScopeEnum = pgEnum('knowledge_scope', ['personal', 'team', 'organization']);
export const knowledgeStatusEnum = pgEnum('knowledge_status', ['active', 'stale', 'disputed', 'archived']);
export const entityTypeEnum = pgEnum('entity_type', ['person', 'system', 'technology', 'project', 'process', 'team', 'concept']);
export const conflictStatusEnum = pgEnum('conflict_status', ['open', 'resolved', 'dismissed']);

// ============================================================
// Organizations
// ============================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  plan: planEnum('plan').notNull().default('free'),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('org_slug_idx').on(table.slug),
]);

// ============================================================
// Users
// ============================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').notNull().default('member'),
  preferences: jsonb('preferences').default({
    defaultModel: 'openai/gpt-4o',
    theme: 'system',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_email_idx').on(table.email),
  index('user_org_idx').on(table.orgId),
]);

// ============================================================
// Teams
// ============================================================

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('team_org_slug_idx').on(table.orgId, table.slug),
]);

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: teamRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('team_member_idx').on(table.teamId, table.userId),
]);

// ============================================================
// Conversations
// ============================================================

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull().default('New Conversation'),
  visibility: conversationVisibilityEnum('visibility').notNull().default('private'),
  modelDefault: varchar('model_default', { length: 255 }).notNull().default('openai/gpt-4o'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('conv_user_idx').on(table.userId),
  index('conv_org_idx').on(table.orgId),
  index('conv_updated_idx').on(table.updatedAt),
]);

export const conversationParticipants = pgTable('conversation_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('participant'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('conv_participant_idx').on(table.conversationId, table.userId),
]);

// ============================================================
// Messages
// ============================================================

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  modelUsed: varchar('model_used', { length: 255 }),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  cost: real('cost'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('msg_conv_idx').on(table.conversationId),
  index('msg_created_idx').on(table.conversationId, table.createdAt),
]);

// ============================================================
// Knowledge Atoms
// ============================================================

export const knowledgeAtoms = pgTable('knowledge_atoms', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  type: knowledgeTypeEnum('type').notNull(),
  scope: knowledgeScopeEnum('scope').notNull().default('personal'),
  scopeId: uuid('scope_id').notNull(), // user_id, team_id, or org_id
  content: text('content').notNull(),
  structured: jsonb('structured'),
  confidence: real('confidence').notNull().default(0.5),
  decayRate: real('decay_rate').notNull().default(0.5),
  version: integer('version').notNull().default(1),
  supersedesId: uuid('supersedes_id'),
  status: knowledgeStatusEnum('status').notNull().default('active'),
  sourceConversationId: uuid('source_conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  sourceUserId: uuid('source_user_id').references(() => users.id, { onDelete: 'set null' }),
  extractedBy: varchar('extracted_by', { length: 255 }),
  topics: jsonb('topics').default([]),
  // embedding: vector('embedding', { dimensions: 1536 }),  // Enable when pgvector is set up
  lastAffirmed: timestamp('last_affirmed').defaultNow().notNull(),
  affirmedCount: integer('affirmed_count').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('ka_org_idx').on(table.orgId),
  index('ka_scope_idx').on(table.scope, table.scopeId),
  index('ka_status_idx').on(table.status),
  index('ka_type_idx').on(table.type),
]);

// ============================================================
// Knowledge Entities (for the knowledge graph)
// ============================================================

export const knowledgeEntities = pgTable('knowledge_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: entityTypeEnum('type').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('ke_org_idx').on(table.orgId),
  index('ke_name_idx').on(table.orgId, table.name),
]);

export const knowledgeEntityLinks = pgTable('knowledge_entity_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  atomId: uuid('atom_id').references(() => knowledgeAtoms.id, { onDelete: 'cascade' }).notNull(),
  entityId: uuid('entity_id').references(() => knowledgeEntities.id, { onDelete: 'cascade' }).notNull(),
  relationship: varchar('relationship', { length: 100 }).notNull(),
}, (table) => [
  index('kel_atom_idx').on(table.atomId),
  index('kel_entity_idx').on(table.entityId),
]);

// ============================================================
// Knowledge Conflicts
// ============================================================

export const knowledgeConflicts = pgTable('knowledge_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),
  atomAId: uuid('atom_a_id').references(() => knowledgeAtoms.id, { onDelete: 'cascade' }).notNull(),
  atomBId: uuid('atom_b_id').references(() => knowledgeAtoms.id, { onDelete: 'cascade' }).notNull(),
  status: conflictStatusEnum('status').notNull().default('open'),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Knowledge Retrievals (track what knowledge was useful)
// ============================================================

export const knowledgeRetrievals = pgTable('knowledge_retrievals', {
  id: uuid('id').primaryKey().defaultRandom(),
  atomId: uuid('atom_id').references(() => knowledgeAtoms.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  relevanceScore: real('relevance_score'),
  wasUseful: boolean('was_useful'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Model Usage Tracking
// ============================================================

export const modelUsage = pgTable('model_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  model: varchar('model', { length: 255 }).notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  cost: real('cost').notNull().default(0),
  date: timestamp('date').defaultNow().notNull(),
}, (table) => [
  index('mu_user_date_idx').on(table.userId, table.date),
  index('mu_org_date_idx').on(table.orgId, table.date),
]);

// ============================================================
// Relations
// ============================================================

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  teams: many(teams),
  conversations: many(conversations),
  knowledgeAtoms: many(knowledgeAtoms),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  conversations: many(conversations),
  teamMemberships: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.orgId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [conversations.orgId],
    references: [organizations.id],
  }),
  messages: many(messages),
  participants: many(conversationParticipants),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const knowledgeAtomsRelations = relations(knowledgeAtoms, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [knowledgeAtoms.orgId],
    references: [organizations.id],
  }),
  sourceConversation: one(conversations, {
    fields: [knowledgeAtoms.sourceConversationId],
    references: [conversations.id],
  }),
  sourceUser: one(users, {
    fields: [knowledgeAtoms.sourceUserId],
    references: [users.id],
  }),
  entityLinks: many(knowledgeEntityLinks),
}));
