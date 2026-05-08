import { InterviewRoom } from '@/components/voice/interview-room';

export const metadata = { title: 'Voice interview · Osmer' };

type Flow = 'founder_interview' | 'employee_intro';

function parseFlow(value: string | string[] | undefined): Flow {
  return value === 'employee_intro' ? 'employee_intro' : 'founder_interview';
}

export default async function VoiceInterviewPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string | string[] }>;
}) {
  const sp = await searchParams;
  const flow = parseFlow(sp.flow);
  return <InterviewRoom flow={flow} />;
}
