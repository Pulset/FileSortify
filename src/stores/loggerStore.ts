import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LogEntry } from '../types';

interface LoggerState {
  logs: LogEntry[];

  // Actions
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  getLogs: () => LogEntry[];
}

export const useLoggerStore = create<LoggerState>()(
  persist(
    (set, get) => ({
      logs: [],

      addLog: (message: string, type: LogEntry['type'] = 'info') => {
        const newLog: LogEntry = {
          id: Date.now().toString(36) + Math.random().toString(36).substring(2),
          timestamp: new Date().toLocaleString(),
          message,
          type
        };

        set(state => ({
          logs: [newLog, ...state.logs].slice(0, 1000) // Keep only last 1000 logs
        }));
      },

      clearLogs: () => {
        set({ logs: [] });
      },

      getLogs: () => {
        const { logs } = get();
        return logs;
      },
    }),
    {
      name: 'logger-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        logs: state.logs.slice(0, 1000), // 只保存最近100条日志到持久化存储
      }),
    }
  )
);