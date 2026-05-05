export type SourceType = 'conversation' | 'document' | 'interview' | 'crawl';
export type SourceStatus = 'active' | 'archived' | 'deleted';

export interface SourceRow {
  id: string;
  orgId: string;
  ownerUserId: string | null;
  type: SourceType;
  title: string | null;
  status: SourceStatus;
  meta: Record<string, unknown>;
  validAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkRow {
  id: string;
  sourceId: string;
  orgId: string;
  ord: number;
  role: 'user' | 'assistant' | null;
  speakerUserId: string | null;
  content: string;
  tokenCount: number | null;
  embeddingVersion: number;
  meta: Record<string, unknown>;
  validAt: Date;
  invalidAt: Date | null;
  createdAt: Date;
}

export type AtomType = 'fact' | 'decision' | 'preference';
export type AtomStatus = 'active' | 'stale' | 'superseded';

export interface AtomRow {
  id: string;
  orgId: string;
  scopeUserId: string | null;
  scopeTeamId: string | null;
  type: AtomType;
  content: string;
  confidence: number;
  affirmedCount: number;
  lastAffirmed: Date;
  status: AtomStatus;
  supersedesId: string | null;
  validAt: Date;
  invalidAt: Date | null;
  sourceIds: string[];
  topics: string[];
  embeddingVersion: number;
}

export type RetrievalSignal = 'semantic' | 'lexical' | 'entity';

export interface RetrievalCandidate {
  chunkId: string;
  sourceId: string;
  content: string;
  signal: RetrievalSignal;
  rawScore: number;
  speakerUserId: string | null;
  validAt: Date;
  meta: Record<string, unknown>;
}

export interface RetrievalResult {
  chunkId: string;
  sourceId: string;
  content: string;
  finalScore: number;
  signals: Array<{ kind: RetrievalSignal; score: number }>;
  speakerUserId: string | null;
  validAt: Date;
  meta: Record<string, unknown>;
}

export interface RetrievalScope {
  userId: string;
  teamIds: string[];
  orgId: string;
  includeOrg: boolean;
}

export interface IngestRequestChunk {
  ord: number;
  content: string;
  role?: 'user' | 'assistant' | null;
  speakerUserId?: string | null;
  meta?: Record<string, unknown>;
}

export interface IngestRequest {
  orgId: string;
  type: SourceType;
  ownerUserId: string | null;
  title?: string;
  meta?: Record<string, unknown>;
  chunks: IngestRequestChunk[];
  sourceId?: string;
}
