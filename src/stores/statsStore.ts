import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Stats, PathConfig } from '../types';

interface StatsState {
  stats: Stats;
  
  // Actions
  updateStatsFromPaths: (paths: PathConfig[]) => void;
  updateFilesOrganized: (count: number) => void;
  setMonitoring: (isMonitoring: boolean) => void;
  updatePathStats: (pathId: string, pathStats: PathConfig['stats']) => void;
  
  // Getters
  getPathStats: (pathId: string) => PathConfig['stats'];
  getMonitoringCount: () => number;
  calculateStatsFromPaths: (paths: PathConfig[]) => Stats;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      stats: {
        filesOrganized: 0,
        lastOrganized: null,
        monitoringSince: null,
        pathStats: {}
      },

      updateStatsFromPaths: (paths: PathConfig[]) => {
        const { calculateStatsFromPaths } = get();
        const newStats = calculateStatsFromPaths(paths);
        set({ stats: newStats });
      },

      updateFilesOrganized: (count: number) => {
        set(state => ({
          stats: {
            ...state.stats,
            filesOrganized: state.stats.filesOrganized + count,
            lastOrganized: new Date().toLocaleString()
          }
        }));
      },

      setMonitoring: (isMonitoring: boolean) => {
        set(state => ({
          stats: {
            ...state.stats,
            monitoringSince: isMonitoring ? new Date().toLocaleString() : null
          }
        }));
      },

      updatePathStats: (pathId: string, pathStats: PathConfig['stats']) => {
        set(state => ({
          stats: {
            ...state.stats,
            pathStats: {
              ...state.stats.pathStats,
              [pathId]: pathStats
            }
          }
        }));
      },

      getPathStats: (pathId: string) => {
        const { stats } = get();
        return stats.pathStats?.[pathId] || {
          filesOrganized: 0,
          lastOrganized: null,
          monitoringSince: null
        };
      },

      getMonitoringCount: () => {
        const { stats } = get();
        if (!stats.pathStats) return 0;
        return Object.values(stats.pathStats).filter(pathStat => pathStat.monitoringSince !== null).length;
      },

      calculateStatsFromPaths: (paths: PathConfig[]) => {
        const totalStats = paths.reduce((total, path) => ({
          filesOrganized: total.filesOrganized + path.stats.filesOrganized,
          lastOrganized: path.stats.lastOrganized && 
            (!total.lastOrganized || new Date(path.stats.lastOrganized) > new Date(total.lastOrganized))
            ? path.stats.lastOrganized : total.lastOrganized,
          monitoringSince: paths.some(p => p.isMonitoring) 
            ? paths.filter(p => p.isMonitoring)
                .map(p => p.stats.monitoringSince)
                .filter(Boolean)
                .sort()[0] || null
            : null
        }), {
          filesOrganized: 0,
          lastOrganized: null as string | null,
          monitoringSince: null as string | null
        });

        // 构建路径统计映射
        const pathStats: { [pathId: string]: PathConfig['stats'] } = {};
        paths.forEach(path => {
          pathStats[path.id] = path.stats;
        });

        return {
          ...totalStats,
          pathStats
        };
      },
    }),
    {
      name: 'stats-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        stats: state.stats,
      }),
    }
  )
);