// ============================================================
// Client-side Knowledge Store (localStorage until DB is ready)
// ============================================================

export interface LocalKnowledgeAtom {
  id: string;
  type: 'fact' | 'decision' | 'preference' | 'solution' | 'relationship' | 'process' | 'context';
  scope: 'personal' | 'team' | 'organization';
  content: string;
  confidence: number;
  topics: string[];
  entities: string[];
  sourceConversationId: string | null;
  extractedBy: string;
  createdAt: string;
  lastAffirmed: string;
  affirmedCount: number;
}

const STORAGE_KEY = 'knowledgee-knowledge';

export function getKnowledgeAtoms(): LocalKnowledgeAtom[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveKnowledgeAtoms(atoms: LocalKnowledgeAtom[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(atoms));
}

export function addKnowledgeAtoms(newAtoms: LocalKnowledgeAtom[]): void {
  const existing = getKnowledgeAtoms();

  // Simple deduplication: skip atoms with very similar content
  const toAdd = newAtoms.filter((newAtom) => {
    return !existing.some((existing) => {
      const similarity = contentSimilarity(existing.content, newAtom.content);
      return similarity > 0.85;
    });
  });

  if (toAdd.length > 0) {
    saveKnowledgeAtoms([...toAdd, ...existing]);
  }
}

export function removeKnowledgeAtom(id: string): void {
  const atoms = getKnowledgeAtoms().filter((a) => a.id !== id);
  saveKnowledgeAtoms(atoms);
}

export function updateKnowledgeAtom(id: string, updates: Partial<LocalKnowledgeAtom>): void {
  const atoms = getKnowledgeAtoms().map((a) =>
    a.id === id ? { ...a, ...updates } : a
  );
  saveKnowledgeAtoms(atoms);
}

// Get knowledge atoms relevant to a query (simple keyword matching for now)
export function searchKnowledge(query: string, limit = 10): LocalKnowledgeAtom[] {
  const atoms = getKnowledgeAtoms();
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  if (queryWords.length === 0) return atoms.slice(0, limit);

  const scored = atoms.map((atom) => {
    const text = `${atom.content} ${atom.topics.join(' ')} ${atom.entities.join(' ')}`.toLowerCase();
    let score = 0;
    for (const word of queryWords) {
      if (text.includes(word)) score++;
    }
    // Boost by confidence and recency
    score *= atom.confidence;
    const ageInDays = (Date.now() - new Date(atom.lastAffirmed).getTime()) / (1000 * 60 * 60 * 24);
    score *= Math.exp(-0.01 * ageInDays); // mild decay
    return { atom, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.atom);
}

// Simple content similarity (Jaccard on word sets)
function contentSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
