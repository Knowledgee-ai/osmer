import { generateObject } from 'ai';
import { z } from 'zod';
import { getLanguageModel } from '../../src/lib/ai/router';

const Rubric = z.object({
  structuralMatch: z.number().min(0).max(5),
  factualGrounding: z.number().min(0).max(5),
  toneMatch: z.number().min(0).max(5),
  completeness: z.number().min(0).max(5),
  noHallucination: z.number().min(0).max(5),
  notes: z.string(),
});

export type RubricScore = z.infer<typeof Rubric>;

/**
 * Grade an AI Employee's output against an exemplar using a Sonnet
 * judge. Returns five 0-5 scores + a free-form note. Used by M4's
 * per-employee output evaluation; keeps the rubric here in M3 so M4
 * can wire it without re-defining.
 */
export async function scoreOutput(args: {
  exemplar: string;
  output: string;
  jobDescription: string;
  judgeModelId?: string;
}): Promise<RubricScore> {
  const model = getLanguageModel(args.judgeModelId ?? 'anthropic/claude-sonnet-4-6');
  const { object } = await generateObject({
    model,
    schema: Rubric,
    prompt: `You are grading an AI Employee's output against an exemplar.

Score 0-5 on each dimension (5 = excellent):
- structuralMatch: same shape as the exemplar (sections, length, format)
- factualGrounding: claims supported by the inputs / exemplar; no invented facts
- toneMatch: voice, register, vocabulary mirror the exemplar
- completeness: covers what the job description asks for
- noHallucination: zero invented entities, dates, numbers, URLs

## Job description
${args.jobDescription}

## Exemplar (the gold reference)
${args.exemplar}

## Output to grade
${args.output}`,
  });
  return object;
}
