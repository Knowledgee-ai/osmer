import type { StoredMessage } from '@/lib/messages/store';
import { MODEL_MAP } from '@/lib/ai/models';

export function exportConversationAsMarkdown(
  title: string,
  messages: StoredMessage[]
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`*Exported from Knowledge HQ on ${new Date().toLocaleDateString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`## User`);
      lines.push('');
      lines.push(msg.content);
    } else if (msg.role === 'assistant') {
      const model = msg.modelUsed ? MODEL_MAP.get(msg.modelUsed) : null;
      const modelLabel = model ? model.name : msg.modelUsed || 'AI';
      lines.push(`## ${modelLabel}`);
      lines.push('');
      lines.push(msg.content);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
