import { create } from 'zustand';
import { Stats, PathConfig } from '../types';
import { usePathsStore } from './pathsStore';

interface StatsState {
  // Getters
  getPathStats: (pathId: string) => PathConfig['stats'];
  getMonitoringCount: () => number;
  calculateStatsFromPaths: (paths?: PathConfig[]) => Stats;
}

export const useStatsStore = create<StatsState>()(() => ({
  getPathStats: (pathId: string) => {
    const paths = usePathsStore.getState().paths;
    return (
      paths.find((p) => p.id === pathId)?.stats || {
        filesOrganized: 0,
        lastOrganized: null,
        monitoringSince: null,
      }
    );
  },
  getMonitoringCount: () => {
    const paths = usePathsStore.getState().paths;
    return paths.filter((p) => p.isMonitoring).length;
  },
  calculateStatsFromPaths: (pathsArg?: PathConfig[]) => {
    const paths = pathsArg || usePathsStore.getState().paths;
    const totalStats = paths.reduce(
      (total, path) => ({
        filesOrganized:
          total.filesOrganized + (path.stats?.filesOrganized || 0),
        lastOrganized:
          path.stats?.lastOrganized &&
          (!total.lastOrganized ||
            new Date(path.stats.lastOrganized) > new Date(total.lastOrganized))
            ? path.stats.lastOrganized
            : total.lastOrganized,
        monitoringSince: paths.some((p) => p.isMonitoring)
          ? paths
              .filter((p) => p.isMonitoring)
              .map((p) => p.stats?.monitoringSince)
              .filter(Boolean)
              .sort()[0] || null
          : null,
      }),
      {
        filesOrganized: 0,
        lastOrganized: null as string | null,
        monitoringSince: null as string | null,
      }
    );
    // 构建路径统计映射
    const pathStats: { [pathId: string]: PathConfig['stats'] } = {};
    paths.forEach((path) => {
      pathStats[path.id] = path.stats;
    });
    return {
      ...totalStats,
      pathStats,
    };
  },
}));
