import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: SettingsStore['theme']) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'osmer-settings',
    }
  )
);
