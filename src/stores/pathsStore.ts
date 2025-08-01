import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PathConfig } from '../types';
import { tauriAPI } from '../utils/tauri';
import { useConfigStore } from './configStore';

interface PathsState {
  paths: PathConfig[];
  loading: boolean;

  // Actions
  loadPaths: () => Promise<void>;
  addPath: (path: string, name?: string) => Promise<PathConfig>;
  removePath: (pathId: string) => Promise<void>;
  updatePath: (pathId: string, updates: Partial<PathConfig>) => Promise<void>;
  togglePathMonitoring: (pathId: string) => Promise<boolean>;
  organizePathFiles: (pathId: string) => Promise<number>;

  // Getters
  getPath: (pathId: string) => PathConfig | undefined;
  getMonitoringPaths: () => PathConfig[];
  getTotalStats: () => {
    filesOrganized: number;
    lastOrganized: string | null;
    monitoringSince: string | null;
  };

  // Internal helpers
  savePaths: (newPaths: PathConfig[]) => Promise<void>;
  generatePathId: () => string;
}

export const usePathsStore = create<PathsState>()(
  persist(
    (set, get) => ({
      paths: [],
      loading: false,

      loadPaths: async () => {
        const { loading } = get();

        if (loading) {
          console.log('Already loading paths, skipping...');
          return;
        }

        set({ loading: true });

        try {
          if (tauriAPI.isInitialized()) {
            console.log('Loading paths configuration...');
            const config = useConfigStore.getState().config;
            console.log('Config loaded:', config);

            if (config.paths && config.paths.length > 0) {
              console.log('Found paths in config:', config.paths);
              set({ paths: config.paths });
            } else if (config.downloads_folder) {
              console.log('Migrating old config:', config.downloads_folder);
              const migratedPath: PathConfig = {
                id: 'migrated-default',
                path: config.downloads_folder,
                name: '默认下载文件夹',
                isMonitoring: false,
                autoOrganize: config.auto_organize || false,
                stats: {
                  filesOrganized: 0,
                  lastOrganized: null,
                  monitoringSince: null,
                },
              };
              const newPaths = [migratedPath];
              set({ paths: newPaths });

              try {
                const updatedConfig = { ...config, paths: newPaths };
                await useConfigStore.getState().saveConfig(updatedConfig);
                console.log('Migration config saved');
              } catch (error) {
                console.error('Failed to save migrated config:', error);
              }
            } else {
              console.log('No existing config, creating default path...');
              try {
                const defaultFolder =
                  await tauriAPI.getDefaultDownloadsFolder();
                console.log('Default folder:', defaultFolder);
                const defaultPath: PathConfig = {
                  id: 'default-downloads',
                  path: defaultFolder,
                  name: '下载文件夹',
                  isMonitoring: false,
                  autoOrganize: false,
                  stats: {
                    filesOrganized: 0,
                    lastOrganized: null,
                    monitoringSince: null,
                  },
                };
                const newPaths = [defaultPath];
                set({ paths: newPaths });

                try {
                  const updatedConfig = { ...config, paths: newPaths };
                  await useConfigStore.getState().saveConfig(updatedConfig);
                  console.log('Default config saved');
                } catch (error) {
                  console.error('Failed to save default config:', error);
                }
              } catch (error) {
                console.error('Failed to get default folder:', error);
                set({ paths: [] });
              }
            }
          } else {
            console.log('Tauri not initialized, setting empty paths');
            set({ paths: [] });
          }
        } catch (error) {
          console.error('Failed to load paths:', error);
          set({ paths: [] });
        } finally {
          set({ loading: false });
        }
      },

      addPath: async (path: string, name?: string) => {
        const { paths, savePaths, generatePathId } = get();

        if (!path.trim()) {
          throw new Error('路径不能为空');
        }

        if (paths.some((p) => p.path === path)) {
          throw new Error('该路径已存在');
        }

        const newPath: PathConfig = {
          id: generatePathId(),
          path: path.trim(),
          name: name?.trim() || `路径 ${paths.length + 1}`,
          isMonitoring: false,
          autoOrganize: false,
          stats: {
            filesOrganized: 0,
            lastOrganized: null,
            monitoringSince: null,
          },
        };
        console.log({ newPath, paths });
        const newPaths = [...paths, newPath];
        await savePaths(newPaths);

        return newPath;
      },

      removePath: async (pathId: string) => {
        const { paths, savePaths } = get();
        const pathToRemove = paths.find((p) => p.id === pathId);
        if (!pathToRemove) {
          throw new Error('路径不存在');
        }

        if (pathToRemove.isMonitoring) {
          try {
            await tauriAPI.toggleMonitoring(pathToRemove.path);
          } catch (error) {
            console.warn('停止监控失败:', error);
          }
        }

        const newPaths = paths.filter((p) => p.id !== pathId);
        await savePaths(newPaths);
      },

      updatePath: async (pathId: string, updates: Partial<PathConfig>) => {
        const { paths, savePaths } = get();
        const pathIndex = paths.findIndex((p) => p.id === pathId);
        if (pathIndex === -1) {
          throw new Error('路径不存在');
        }

        const updatedPaths = [...paths];
        updatedPaths[pathIndex] = { ...updatedPaths[pathIndex], ...updates };

        await savePaths(updatedPaths);
      },

      togglePathMonitoring: async (pathId: string) => {
        const { paths, updatePath } = get();
        const path = paths.find((p) => p.id === pathId);
        if (!path) {
          throw new Error('路径不存在');
        }

        try {
          const newMonitoringState = await tauriAPI.toggleMonitoring(path.path);

          const updates: Partial<PathConfig> = {
            isMonitoring: newMonitoringState,
            stats: {
              ...path.stats,
              monitoringSince: newMonitoringState
                ? new Date().toLocaleString()
                : null,
            },
          };

          await updatePath(pathId, updates);
          return newMonitoringState;
        } catch (error) {
          throw error;
        }
      },

      organizePathFiles: async (pathId: string) => {
        const { paths, updatePath } = get();
        const path = paths.find((p) => p.id === pathId);
        if (!path) {
          throw new Error('路径不存在');
        }

        try {
          const result = await tauriAPI.organizeFiles(path.path);
          const fileCount = parseInt(result.match(/\d+/)?.[0] || '0');

          const updates: Partial<PathConfig> = {
            stats: {
              ...path.stats,
              filesOrganized: path.stats.filesOrganized + fileCount,
              lastOrganized: new Date().toLocaleString(),
            },
          };

          await updatePath(pathId, updates);

          await tauriAPI.sendNotification(
            '文件整理完成',
            `${path.name}: ${result}`
          );

          return fileCount;
        } catch (error) {
          throw error;
        }
      },

      getPath: (pathId: string) => {
        const { paths } = get();
        return paths.find((p) => p.id === pathId);
      },

      getMonitoringPaths: () => {
        const { paths } = get();
        return paths.filter((p) => p.isMonitoring);
      },

      getTotalStats: () => {
        const { paths } = get();
        return paths.reduce(
          (total, path) => ({
            filesOrganized: total.filesOrganized + path.stats.filesOrganized,
            lastOrganized:
              path.stats.lastOrganized &&
              (!total.lastOrganized ||
                new Date(path.stats.lastOrganized) >
                  new Date(total.lastOrganized))
                ? path.stats.lastOrganized
                : total.lastOrganized,
            monitoringSince: paths.some((p) => p.isMonitoring)
              ? paths
                  .filter((p) => p.isMonitoring)
                  .map((p) => p.stats.monitoringSince)
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
      },

      savePaths: async (newPaths: PathConfig[]) => {
        try {
          console.log('Saving paths:', newPaths);
          if (tauriAPI.isInitialized()) {
            const config = useConfigStore.getState().config;
            console.log('Current config:', config);

            const updatedConfig = {
              ...config,
              paths: newPaths,
            };

            console.log('Saving updated config:', updatedConfig);
            await useConfigStore.getState().saveConfig(updatedConfig);

            set({ paths: newPaths });
            console.log('Local paths updated:', newPaths);
          } else {
            set({ paths: newPaths });
            console.log('Tauri not initialized, only updating local state');
          }
        } catch (error) {
          console.error('Failed to save paths:', error);
          throw error;
        }
      },

      generatePathId: () => {
        return (
          Date.now().toString(36) + Math.random().toString(36).substring(2)
        );
      },
    }),
    {
      name: 'paths-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        paths: state.paths,
      }),
    }
  )
);
