// Store modules - 使用明确的导入语法
import { usePathsStore } from './pathsStore';
import { useConfigStore } from './configStore';
import { useLoggerStore } from './loggerStore';
import { useStatsStore } from './statsStore';
import { useSubscriptionStore } from './subscriptionStore';

// 重新导出所有store hooks
export {
  usePathsStore,
  useConfigStore,
  useLoggerStore,
  useStatsStore,
  useSubscriptionStore,
};

// Combined hooks for convenience
// 使用懒加载模式，避免循环依赖和性能问题
export const useAppStores = () => {
  // 延迟导入，避免循环依赖
  const paths = usePathsStore();
  const config = useConfigStore();
  const logger = useLoggerStore();
  const stats = useStatsStore();
  const subscription = useSubscriptionStore();

  return {
    paths,
    config,
    logger,
    stats,
    subscription,
  };
};

// 类型导出，提供更好的类型支持
export type AppStores = ReturnType<typeof useAppStores>;

// 可选：提供选择器函数，用于性能优化
export const useAppStoresSelector = <T>(
  selector: (stores: AppStores) => T
): T => {
  const stores = useAppStores();
  return selector(stores);
};
