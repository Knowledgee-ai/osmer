import type { z, ZodTypeAny } from 'zod';

export type ToolPermission = 'baseline' | 'paid' | 'admin_grant' | 'irreversible';

export interface ToolContext {
  orgId: string;
  userId: string | null;
  runId: string;
  employeeId: string;
  memoryScope: MemoryScope;
}

export type MemoryScope =
  | { kind: 'org' }
  | { kind: 'topics'; topics: string[] }
  | { kind: 'sources'; sourceIds: string[] }
  | { kind: 'team'; teamId: string };

export interface Tool<S extends ZodTypeAny = ZodTypeAny> {
  id: string;
  description: string;
  parameters: S;
  permission: ToolPermission;
  execute(args: z.infer<S>, ctx: ToolContext): Promise<unknown>;
  costEstimateCents?(args: z.infer<S>): number;
}

export interface RunStep {
  ts: string;
  kind: 'tool_call' | 'tool_result' | 'model_text' | 'awaiting_approval';
  toolId?: string;
  args?: unknown;
  result?: unknown;
  text?: string;
  approvalId?: string;
}

export interface EmployeeInputSpec {
  key: string;
  label: string;
  kind: 'string' | 'url' | 'longtext';
  required: boolean;
}
