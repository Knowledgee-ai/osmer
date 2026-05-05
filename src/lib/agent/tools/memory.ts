import { z } from 'zod';
import type { Tool } from '../types';
import { retrieve } from '@/lib/memory/retrieve';
import { ingestSource } from '@/lib/memory/ingest';

const MemoryQueryParams = z.object({
  query: z.string(),
  topK: z.number().int().min(1).max(20).default(8),
});

export const memoryQueryTool: Tool<typeof MemoryQueryParams> = {
  id: 'memory.query',
  description: 'Search the company memory for passages relevant to a query. Returns top-K passages with provenance and a relevance score.',
  parameters: MemoryQueryParams,
  permission: 'baseline',
  costEstimateCents: () => 1,
  async execute(args, ctx) {
    const r = await retrieve({
      query: args.query,
      scope: { userId: ctx.userId ?? '', teamIds: [], orgId: ctx.orgId, includeOrg: ctx.memoryScope.kind !== 'team' },
      topN: args.topK ?? 8,
    });
    return {
      passages: r.map((x) => ({
        chunkId: x.chunkId,
        sourceId: x.sourceId,
        content: x.content,
        score: x.finalScore,
      })),
    };
  },
};

const MemoryWriteParams = z.object({
  content: z.string(),
  type: z.enum(['fact', 'decision', 'preference']),
  topics: z.array(z.string()).default([]),
});

export const memoryWriteTool: Tool<typeof MemoryWriteParams> = {
  id: 'memory.write',
  description: 'Record a finding back to the company memory (e.g., a new fact about a customer). Requires admin grant per-employee AND per-run user approval.',
  parameters: MemoryWriteParams,
  permission: 'irreversible',
  costEstimateCents: () => 2,
  async execute(args, ctx) {
    const sourceId = await ingestSource({
      orgId: ctx.orgId,
      type: 'document',
      ownerUserId: ctx.userId,
      title: `agent-writeback (${ctx.employeeId})`,
      chunks: [{ ord: 0, content: args.content }],
      meta: { runId: ctx.runId, type: args.type, topics: args.topics, employeeId: ctx.employeeId },
    });
    return { sourceId };
  },
};
