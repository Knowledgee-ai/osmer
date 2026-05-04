// ============================================================
// Osmer Core Types
// ============================================================

// --- Models & Providers ---

export type ModelProviderId = 'openai' | 'anthropic' | 'google' | 'xai' | 'meta' | 'openrouter';

export interface Model {
  id: string;                    // e.g. "gpt-4o", "claude-sonnet-4-20250514"
  name: string;                  // e.g. "GPT-4o", "Claude Sonnet 4"
  provider: ModelProviderId;
  contextWindow: number;
  inputCostPer1M: number;       // dollars per 1M tokens
  outputCostPer1M: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  category: 'flagship' | 'fast' | 'mini';
}

// --- Knowledge ---

export type KnowledgeAtomType =
  | 'fact'
  | 'decision'
  | 'preference'
  | 'solution'
  | 'relationship'
  | 'process'
  | 'context';

export type KnowledgeScope = 'personal' | 'team' | 'organization';

export type KnowledgeStatus = 'active' | 'stale' | 'disputed' | 'archived';

export interface KnowledgeAtom {
  id: string;
  orgId: string;
  type: KnowledgeAtomType;
  scope: KnowledgeScope;
  scopeId: string;              // user_id, team_id, or org_id
  content: string;
  confidence: number;
  decayRate: number;
  version: number;
  supersedesId: string | null;
  status: KnowledgeStatus;
  sourceConversationId: string | null;
  sourceUserId: string;
  extractedBy: string | null;   // model that extracted it
  topics: string[];
  entities: EntityRef[];
  embedding: number[] | null;
  lastAffirmed: Date;
  affirmedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityRef {
  id: string;
  name: string;
  type: 'person' | 'system' | 'technology' | 'project' | 'process' | 'team' | 'concept';
  relationship: string;
}

// --- Conversations ---

export type ConversationVisibility = 'private' | 'team' | 'organization';

export interface Conversation {
  id: string;
  orgId: string;
  userId: string;
  teamId: string | null;
  title: string;
  visibility: ConversationVisibility;
  modelDefault: string;         // model ID
  knowledgeMode: 'personal' | 'team' | 'company' | 'locked';
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  cost: number | null;
  createdAt: Date;
}

// --- Users & Organizations ---

export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  orgId: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  preferences: UserPreferences;
  createdAt: Date;
}

export interface UserPreferences {
  defaultModel: string;
  defaultKnowledgeMode: 'personal' | 'team' | 'company' | 'locked';
  theme: 'light' | 'dark' | 'system';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team' | 'business' | 'enterprise';
  createdAt: Date;
}

export interface Team {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  createdAt: Date;
}

// --- API Types ---

export interface ChatRequest {
  conversationId: string;
  message: string;
  modelId: string;
}

export interface StreamingChatResponse {
  id: string;
  conversationId: string;
  content: string;
  modelUsed: string;
  done: boolean;
}

export interface KnowledgeSearchResult {
  atom: KnowledgeAtom;
  relevanceScore: number;
}

// --- Client State ---

export interface AppState {
  activeConversationId: string | null;
  selectedModel: string;
  sidebarOpen: boolean;
  knowledgeMode: 'personal' | 'team' | 'company' | 'locked';
}
