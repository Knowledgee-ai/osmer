import { auth } from '@/lib/auth';
import { saveKnowledgeAtomToDb } from '@/lib/knowledge/db-store';

// POST /api/onboarding — seed knowledge base from onboarding answers
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { answers } = await req.json() as {
    answers: {
      companyName?: string;
      industry?: string;
      role?: string;
      techStack?: string;
      currentProjects?: string;
    };
  };

  const atoms: Array<{ type: string; content: string; confidence: number; topics: string[]; entities: string[] }> = [];

  if (answers.companyName) {
    atoms.push({
      type: 'fact',
      content: `The company name is ${answers.companyName}`,
      confidence: 1.0,
      topics: ['company', 'organization'],
      entities: [answers.companyName],
    });
  }

  if (answers.industry) {
    atoms.push({
      type: 'fact',
      content: `The company operates in the ${answers.industry} industry`,
      confidence: 1.0,
      topics: ['company', 'industry'],
      entities: [answers.industry],
    });
  }

  if (answers.role) {
    atoms.push({
      type: 'preference',
      content: `User's role is ${answers.role}`,
      confidence: 1.0,
      topics: ['user', 'role'],
      entities: [answers.role],
    });
  }

  if (answers.techStack) {
    const techs = answers.techStack.split(',').map(t => t.trim()).filter(Boolean);
    atoms.push({
      type: 'fact',
      content: `The technology stack includes: ${techs.join(', ')}`,
      confidence: 0.95,
      topics: ['technology stack', 'engineering'],
      entities: techs,
    });
  }

  if (answers.currentProjects) {
    atoms.push({
      type: 'context',
      content: `Current projects/focus: ${answers.currentProjects}`,
      confidence: 0.9,
      topics: ['projects', 'current work'],
      entities: [],
    });
  }

  // Save all atoms to DB with embeddings
  const saved = await Promise.all(
    atoms.map((atom) =>
      saveKnowledgeAtomToDb({
        ...atom,
        sourceConversationId: 'onboarding',
        extractedBy: 'onboarding',
        userId: session.user!.id!,
      }).catch(() => null)
    )
  );

  return Response.json({
    atomsCreated: saved.filter(Boolean).length,
  });
}
