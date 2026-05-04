// ============================================================
// Client-side Message Store (localStorage until DB is ready)
// ============================================================

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string;
  createdAt: string;
  // Sender attribution for multi-user conversations. Null for assistant
  // turns and for legacy messages that predate user attribution.
  userId?: string | null;
  senderName?: string | null;
}

const STORAGE_KEY = 'osmer-messages';

function getStore(): Record<string, StoredMessage[]> {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, StoredMessage[]>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getMessages(conversationId: string): StoredMessage[] {
  return getStore()[conversationId] || [];
}

export function saveMessages(conversationId: string, messages: StoredMessage[]): void {
  const store = getStore();
  store[conversationId] = messages;
  saveStore(store);
}

export function deleteConversationMessages(conversationId: string): void {
  const store = getStore();
  delete store[conversationId];
  saveStore(store);
}

export function getAllConversationIds(): string[] {
  return Object.keys(getStore());
}
