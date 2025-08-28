import { useState, useEffect, useCallback } from 'react';
import { ViewType } from './types';
import { tauriAPI } from './utils/tauri';
import {
  usePathsStore,
  useConfigStore,
  useLoggerStore,
  useStatsStore,
  useHistoryStore,
} from './stores';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { message } from '@tauri-apps/plugin-dialog';
// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrganizeView from './components/OrganizeView';
import RulesView from './components/RulesView';
import LogsView from './components/LogsView';
import HistoryView from './components/HistoryView';
import SubscriptionView from './components/SubscriptionView';
import SettingsView from './components/SettingsView';
import { UpdateDialog } from './components/UpdateDialog';

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const { t } = useI18n();

  // 使用模块化的store
  const { addLog } = useLoggerStore();
  const { config, loading: configLoading, loadConfig } = useConfigStore();
  const { paths, loadPaths, organizePathFiles } = usePathsStore();
  const { calculateStatsFromPaths } = useStatsStore();
  const { addHistoryEntry } = useHistoryStore();

  const handleOrganizeFiles = async (pathId: string) => {
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;

    try {
      addLog(
        `🔄 ${t('organize.organizingFiles', { name: path.name })}`,
        'info'
      );
      const fileCount = await organizePathFiles(pathId);
      addLog(
        `✅ ${t('organize.filesOrganizedCount', {
          name: path.name,
          count: fileCount,
        })}`,
        'success'
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : error;
      addLog(
        `❌ ${t('organize.organizationFailed', {
          name: path.name,
          error: msg,
        })}`,
        'error'
      );
      await message(`${t('errors.organizationFailed')}: ${msg}`, {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const handleBatchOrganizeFiles = useCallback(async () => {
    for (const path of paths) {
      await handleOrganizeFiles(path.id);
    }
  }, [paths]);

  useEffect(() => {
    const unListeners: any[] = [];
    const initializeApp = async () => {
      console.log('Starting app initialization...');
      const initialized = await tauriAPI.initialize();
      console.log('Tauri initialized:', initialized);

      if (initialized) {
        try {
          const canUse = await tauriAPI.canUseApp();

          if (canUse) {
            addLog(t('messages.appStarted'), 'success');
          } else {
            addLog(t('messages.trialExpired'), 'warning');
          }

          // 初始化数据
          await Promise.all([loadConfig(), loadPaths()]);
          tauriAPI.canUseAppSecure();
          // 设置事件监听器
          // tauriAPI.listen('organize-files', () => {
          //   handleBatchOrganizeFiles();
          // });

          // tauriAPI.listen('toggle-monitoring', () => {
          //   // 这个事件现在由各个路径的监控状态处理
          //   addLog(t('messages.monitoringStatusUpdated'), 'info');
          // });

          // 监听文件整理事件来更新统计数据
          const unListen1 = tauriAPI.listen(
            'file-organized',
            async (event: {
              payload: {
                file_name: string;
                actual_file_name: string;
                category: string;
                timestamp: string;
                folder_path?: string;
                original_path: string;
                moved_to_path: string;
              };
            }) => {
              const payload = event.payload;
              console.log('File organized event:', event);
              addLog(
                t('messages.fileOrganized', {
                  fileName: payload.actual_file_name, // 使用实际的文件名
                  category: payload.category,
                }),
                'success'
              );
              
              // 添加到文件移动历史，使用实际的路径信息
              if (payload.folder_path) {
                addHistoryEntry({
                  file_name: payload.actual_file_name, // 使用实际的文件名
                  original_path: payload.original_path, // 使用实际的原始路径
                  moved_to_path: payload.moved_to_path, // 使用实际的移动路径
                  category: payload.category,
                  timestamp: payload.timestamp,
                  folder_path: payload.folder_path,
                });
              }
              
              // 自动统计到 pathsStore
              if (payload.folder_path) {
                const path = usePathsStore
                  .getState()
                  .paths.find((p) => p.path === payload.folder_path);
                if (path) {
                  // 更新 stats
                  await usePathsStore.getState().updatePath(path.id, {
                    stats: {
                      ...path.stats,
                      filesOrganized: (path.stats?.filesOrganized || 0) + 1,
                      lastOrganized: payload.timestamp,
                    },
                  });
                }
              }
            }
          );

          // 监听更新相关事件
          const unListen2 = tauriAPI.listen(
            'update-available',
            () => {
              addLog(t('messages.updateAvailable'), 'info');
              setShowUpdateDialog(true);
            }
          );

          unListeners.push(unListen1, unListen2);
        } catch (error) {
          addLog(
            t('errors.initializationFailed', {
              error: error instanceof Error ? error?.message : error,
            }),
            'error'
          );
        }
      } else {
        addLog(t('errors.tauriInitFailed'), 'error');
      }
    };

    initializeApp();
    return () => {
      console.log('Cleaning up event listeners...', unListeners);
      // unListeners.forEach((unListen) => unListen());
      Promise.all(unListeners)
        .then(() => {
          console.log('All event listeners cleaned up successfully');
        })
        .catch(() => {
          console.warn('Error cleaning up event listeners');
        });
    };
  }, []);

  // 统计数据直接通过 paths 计算
  const stats = calculateStatsFromPaths(paths);

  const handleToggleMonitoring = async () => {
    // 判断当前是否有任何路径正在监控
    const anyMonitoring = paths.some((p) => p.isMonitoring);
    // 切换所有路径的监控状态，并通知服务端
    for (const path of paths) {
      if (path.isMonitoring !== !anyMonitoring) {
        const newState = await usePathsStore
          .getState()
          .togglePathMonitoring(path.id);
        if (newState) {
          addLog(
            `🔍 ${t('organize.monitoringStartedFor', { name: path.name })}`,
            'success'
          );
        } else {
          addLog(
            `⏹️ ${t('organize.monitoringStopped', { name: path.name })}`,
            'info'
          );
        }
      }
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            isMonitoring={paths.some((p) => p.isMonitoring)}
            onOrganizeFiles={handleBatchOrganizeFiles}
            onToggleMonitoring={handleToggleMonitoring}
          />
        );
      case 'organize':
        return <OrganizeView />;
      case 'rules':
        return <RulesView config={config} loading={configLoading} />;
      case 'logs':
        return <LogsView />;
      case 'history':
        return <HistoryView />;
      case 'subscription':
        return <SubscriptionView />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className='app'>
      <div className='app-container'>
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className='main-content'>{renderCurrentView()}</main>
      </div>
      <UpdateDialog
        isOpen={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
      />
    </div>
  );
}

function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

export default App;
