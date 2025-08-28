import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface FileHistoryEntry {
  id: string;
  file_name: string;
  original_path: string;
  moved_to_path: string;
  category: string;
  timestamp: string;
  folder_path: string;
  source: 'manual' | 'monitoring';
}

interface HistoryState {
  entries: FileHistoryEntry[];

  // Actions
  addHistoryEntry: (entry: Omit<FileHistoryEntry, 'id' | 'source'>) => void;
  clearHistory: () => void;
  getHistoryEntries: (limit?: number) => FileHistoryEntry[];
  removeHistoryEntry: (id: string) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],

      addHistoryEntry: (entry) => {
        const newEntry: FileHistoryEntry = {
          ...entry,
          id: Date.now().toString(36) + Math.random().toString(36).substring(2),
          source: 'monitoring', // 默认为监控，因为大部分是通过监控产生的
        };

        set((state) => ({
          entries: [newEntry, ...state.entries].slice(0, 500), // 保留最近500条记录
        }));
      },

      clearHistory: () => {
        set({ entries: [] });
      },

      getHistoryEntries: (limit = 100) => {
        const { entries } = get();
        return entries.slice(0, limit);
      },

      removeHistoryEntry: (id) => {
        set((state) => ({
          entries: state.entries.filter(entry => entry.id !== id)
        }));
      },
    }),
    {
      name: 'file-history-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        entries: state.entries.slice(0, 200), // 只保存最近200条到持久化存储
      }),
    }
  )
);