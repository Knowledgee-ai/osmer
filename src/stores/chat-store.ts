import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConversationSummary {
  id: string;
  title: string;
  modelDefault: string;
  updatedAt: string;
}

interface ChatStore {
  // Active state
  activeConversationId: string | null;
  selectedModel: string;
  knowledgeMode: 'personal' | 'team' | 'company' | 'locked';

  // Conversations list (sidebar)
  conversations: ConversationSummary[];

  // UI state
  sidebarOpen: boolean;

  // Actions
  setActiveConversation: (id: string | null) => void;
  setSelectedModel: (modelId: string) => void;
  setKnowledgeMode: (mode: ChatStore['knowledgeMode']) => void;
  setSidebarOpen: (open: boolean) => void;
  setConversations: (conversations: ConversationSummary[]) => void;
  addConversation: (conversation: ConversationSummary) => void;
  updateConversationTitle: (id: string, title: string) => void;
  removeConversation: (id: string) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      activeConversationId: null,
      selectedModel: 'anthropic/claude-sonnet-4-20250514',
      knowledgeMode: 'personal',
      conversations: [],
      sidebarOpen: true,

      setActiveConversation: (id) => set({ activeConversationId: id }),

      setSelectedModel: (modelId) => set({ selectedModel: modelId }),

      setKnowledgeMode: (mode) => set({ knowledgeMode: mode }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setConversations: (conversations) => set({ conversations }),

      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations],
        })),

      updateConversationTitle: (id, title) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        })),

      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        })),
    }),
    {
      name: 'knowledgee-chat',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        knowledgeMode: state.knowledgeMode,
        sidebarOpen: state.sidebarOpen,
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
