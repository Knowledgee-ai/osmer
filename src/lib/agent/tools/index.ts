import type { Tool } from '../types';
import { memoryQueryTool, memoryWriteTool } from './memory';
import { webSearchTool } from './web-search';
import { browserFetchTool } from './browser';
import { docPdfTool, docPptxTool } from './doc-gen';
import { imageGenerateTool } from './image-gen';
import { emailDraftTool } from './email-draft';
import { fileWriteTool } from './file-output';

const ALL: Tool[] = [
  memoryQueryTool,
  memoryWriteTool,
  webSearchTool,
  browserFetchTool,
  docPdfTool,
  docPptxTool,
  imageGenerateTool,
  emailDraftTool,
  fileWriteTool,
];

export const TOOLS: Record<string, Tool> = Object.fromEntries(ALL.map((t) => [t.id, t]));

export function pickTools(toolIds: string[]): Tool[] {
  return toolIds.map((id) => TOOLS[id]).filter(Boolean);
}

export { memoryQueryTool, memoryWriteTool };
