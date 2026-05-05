import { authToken, MCP_TOOLS } from '@/lib/mcp/handler';

export const maxDuration = 300;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

/**
 * POST /api/mcp — read-only MCP server (Model Context Protocol).
 *
 * Auth: `Authorization: Bearer <mcp-token>`. Tokens issued via the
 * admin endpoint /api/admin/mcp-tokens; orgs can revoke at any time.
 *
 * Methods: tools/list, tools/call.
 *
 * V1 surface (memory.query, employee.list, employee.run) — write
 * back to memory through MCP is intentionally NOT exposed.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const ctx = await authToken(token);
  if (!ctx) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.method === 'tools/list') {
    return Response.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      },
    });
  }

  if (body.method === 'tools/call') {
    const tool = MCP_TOOLS.find((t) => t.name === body.params?.name);
    if (!tool) {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32601, message: `tool not found: ${body.params?.name}` },
      });
    }
    try {
      const result = await tool.handler((body.params!.arguments as Record<string, unknown>) ?? {}, ctx);
      return Response.json({ jsonrpc: '2.0', id: body.id, result });
    } catch (err) {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  return Response.json({
    jsonrpc: '2.0',
    id: body.id,
    error: { code: -32601, message: `method not found: ${body.method}` },
  });
}
