# Organizational Memory Protocol (OMP) v1.0

## Abstract

The Organizational Memory Protocol (OMP) defines a standard format for representing, exchanging, and managing knowledge extracted from AI conversations across organizations. OMP enables knowledge to flow between AI providers, tools, and people while preserving provenance, confidence, and access controls.

## 1. Knowledge Atom

The fundamental unit of OMP is the **Knowledge Atom** -- a discrete, standalone piece of organizational knowledge.

### 1.1 Atom Schema

```json
{
  "id": "uuid",
  "version": 1,
  "supersedes": "uuid | null",

  "type": "fact | decision | preference | solution | relationship | process | context",
  "content": "Human-readable knowledge statement",
  "structured": {
    "entities": [{ "name": "string", "type": "string", "relationship": "string" }],
    "conditions": "When is this true?",
    "action": "What to do? (solutions/processes)",
    "rationale": "Why? (decisions)"
  },

  "confidence": 0.0-1.0,
  "lifecycle": {
    "created_at": "ISO8601",
    "last_affirmed": "ISO8601",
    "affirmed_count": 0,
    "decay_rate": 0.0-1.0,
    "status": "active | stale | disputed | archived"
  },

  "provenance": {
    "source_type": "conversation | document | manual | import",
    "source_id": "string",
    "source_model": "provider/model-name",
    "extracted_by": "provider/model-name",
    "created_by": "user-id",
    "confirmed_by": ["user-id"]
  },

  "scope": {
    "level": "personal | team | organization",
    "owner": "user-id | team-id | org-id",
    "visibility": "private | team | organization",
    "anonymized": false
  },

  "embedding": [1536-dimensional vector],
  "topics": ["string"],
  "entity_refs": [{ "id": "uuid", "name": "string", "type": "string", "relationship": "string" }]
}
```

### 1.2 Atom Types

| Type | Description | Default Decay Rate |
|------|-------------|-------------------|
| `fact` | Verifiable statement | 0.5 |
| `decision` | Choice made with rationale | 0.2 |
| `preference` | Personal or team preference | 0.3 |
| `solution` | Actionable fix or approach | 0.6 |
| `relationship` | How entities connect | 0.4 |
| `process` | How things work, step-by-step | 0.7 |
| `context` | Current state, temporal info | 0.9 |

## 2. Knowledge Lifecycle

### 2.1 Creation

Atoms are created through:
- **Extraction**: AI analyzes a conversation and extracts knowledge
- **Manual**: User explicitly creates an atom
- **Import**: Bulk import from external sources

### 2.2 Confidence Decay

```
effective_confidence = base_confidence * e^(-decay_rate * days_since_affirmed / 365)
```

### 2.3 Affirmation

When knowledge is re-confirmed (duplicate detected with >0.92 vector similarity):
- `affirmed_count` increments
- `last_affirmed` updates to now
- `confidence` increases by 0.05 (capped at 1.0)

### 2.4 Versioning (Knowledge Replay)

When similar knowledge evolves (0.80-0.92 vector similarity, different content):
- Old atom is archived (`status: "archived"`)
- New atom created with `version: N+1` and `supersedes: old_atom_id`
- Version chain is walkable via recursive queries

### 2.5 Status Transitions

```
active --[confidence < 0.3]--> stale
active --[contradiction detected]--> disputed
active --[new version created]--> archived
stale --[re-affirmed]--> active
disputed --[human resolved]--> active | archived
```

## 3. Three-Tier Scoping

### 3.1 Personal
- Default scope for all extracted knowledge
- Only visible to the atom owner
- No approval needed

### 3.2 Team
- Promoted from personal scope by the owner
- Visible to all team members
- Included in team members' context injection

### 3.3 Organization
- Promoted from team scope by team leads
- Visible to all organization members
- Highest priority in context injection

### 3.4 Scope Promotion Rules
- personal -> team: Requires owner action
- team -> organization: Requires team lead approval
- Knowledge is NEVER automatically promoted without explicit action

## 4. Context Injection

### 4.1 Retrieval
When a user sends a message:
1. Generate embedding for the user's message
2. Search knowledge atoms using cosine similarity
3. Filter by scope (personal + team + org atoms the user has access to)
4. Rank by: similarity * confidence * recency_boost
5. Return top-K atoms

### 4.2 Injection
Retrieved atoms are injected into the AI's system prompt as organizational context. The AI uses them naturally without explicitly mentioning the knowledge base.

## 5. Reconciliation

### 5.1 Staleness Sweep (daily)
Apply decay function to all active atoms. Mark as stale when effective_confidence < 0.3.

### 5.2 Contradiction Detection (weekly)
Find atom pairs with:
- Same scope
- Same type
- Vector similarity > 0.85
- Different content
Flag as conflicts for human review.

### 5.3 Gap Detection (weekly)
Analyze recent questions vs existing knowledge. Identify topics with questions but no matching atoms.

## 6. Exchange Format

### 6.1 Export
Full JSON export including all atoms with embeddings, version chains, and provenance.

### 6.2 Import
Accept atoms in OMP format from external sources. Generate embeddings on import. Deduplicate against existing atoms.

## 7. Privacy

### 7.1 Core Principle
Extract knowledge, not conversations. The organization sees knowledge atoms, not raw chat logs.

### 7.2 Locked Mode
Conversations in locked mode:
- No knowledge extraction
- No context injection
- Messages not used for any analysis

## 8. Versioning

This is OMP v1.0. Future versions will add:
- Federation (cross-organization knowledge exchange)
- Structured entity graph (Neo4j-compatible)
- Multi-modal atoms (images, diagrams)
- Differential privacy for anonymized knowledge
