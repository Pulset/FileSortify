// Store modules
export { usePathsStore } from './pathsStore';
export { useConfigStore } from './configStore';
export { useLoggerStore } from './loggerStore';
export { useStatsStore } from './statsStore';

// Combined hooks for convenience
export const useAppStores = () => ({
  paths: usePathsStore(),
  config: useConfigStore(),
  logger: useLoggerStore(),
  stats: useStatsStore(),
});