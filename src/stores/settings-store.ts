import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  xai?: string;
  openrouter?: string;
}

interface SettingsStore {
  apiKeys: ApiKeys;
  theme: 'dark' | 'light' | 'system';

  setApiKey: (provider: keyof ApiKeys, key: string) => void;
  removeApiKey: (provider: keyof ApiKeys) => void;
  setTheme: (theme: SettingsStore['theme']) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKeys: {},
      theme: 'system',

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key },
        })),

      removeApiKey: (provider) =>
        set((state) => {
          const keys = { ...state.apiKeys };
          delete keys[provider];
          return { apiKeys: keys };
        }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'osmer-settings',
    }
  )
);
