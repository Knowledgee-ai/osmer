import { trace, type Span, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('osmer');

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attrs: Record<string, string | number | boolean> = {},
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    for (const [k, v] of Object.entries(attrs)) span.setAttribute(k, v);
    try {
      const out = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return out;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}
