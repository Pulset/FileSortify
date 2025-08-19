import { useState, useEffect, useCallback } from 'react';
import { ViewType } from './types';
import { tauriAPI } from './utils/tauri';
import { listen } from '@tauri-apps/api/event';
import {
  usePathsStore,
  useConfigStore,
  useLoggerStore,
  useStatsStore,
} from './stores';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { message } from '@tauri-apps/plugin-dialog';
// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrganizeView from './components/OrganizeView';
import RulesView from './components/RulesView';
import LogsView from './components/LogsView';
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
  const { stats, updateStatsFromPaths } = useStatsStore();

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
          tauriAPI.listen('organize-files', () => {
            handleBatchOrganizeFiles();
          });

          tauriAPI.listen('toggle-monitoring', () => {
            // 这个事件现在由各个路径的监控状态处理
            addLog(t('messages.monitoringStatusUpdated'), 'info');
          });

          // 监听文件整理事件来更新统计数据
          tauriAPI.listen(
            'file-organized',
            (event: {
              payload: {
                file_name: string;
                category: string;
                timestamp: string;
                folder_path?: string;
              };
            }) => {
              console.log('File organized event:', event);
              addLog(
                t('messages.fileOrganized', {
                  fileName: event.payload.file_name,
                  category: event.payload.category,
                }),
                'success'
              );
            }
          );

          // 监听更新相关事件
          listen('update-available', (event: any) => {
            addLog(t('messages.updateAvailable'), 'info');
            setShowUpdateDialog(true);
          });
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
  }, []);

  // 当路径数据变化时，更新统计数据
  useEffect(() => {
    if (paths.length > 0) {
      updateStatsFromPaths(paths);
    }
  }, [paths, updateStatsFromPaths]);

  const handleToggleMonitoring = async () => {
    // 计算监控路径数量
    const monitoringPathsCount = stats.pathStats
      ? Object.values(stats.pathStats).filter(
          (pathStat) => pathStat.monitoringSince !== null
        ).length
      : 0;
    addLog(
      t('messages.monitoringStatus', { count: monitoringPathsCount }),
      'info'
    );
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            isMonitoring={
              stats.pathStats
                ? Object.values(stats.pathStats).some(
                    (pathStat) => pathStat.monitoringSince !== null
                  )
                : false
            }
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
