// Store modules
export { usePathsStore } from './pathsStore';
export { useConfigStore } from './configStore';
export { useLoggerStore } from './loggerStore';
export { useStatsStore } from './statsStore';
export { useSubscriptionStore } from './subscriptionStore';

// Combined hooks for convenience
export const useAppStores = () => ({
  paths: usePathsStore(),
  config: useConfigStore(),
  logger: useLoggerStore(),
  stats: useStatsStore(),
  subscription: useSubscriptionStore(),
});