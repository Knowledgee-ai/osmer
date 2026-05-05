export interface LMETask {
  question_id: string;
  question_type: 'single-session-user' | 'single-session-assistant' | 'temporal-reasoning' | 'multi-session' | 'knowledge-update';
  question: string;
  answer?: string;
  haystack_sessions: Array<Array<{ role: 'user' | 'assistant'; content: string }>>;
  answer_session_ids?: string[] | number[];
  haystack_session_ids?: string[];
}
