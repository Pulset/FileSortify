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
import { I18nProvider } from './contexts/I18nContext';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrganizeView from './components/OrganizeView';
import RulesView from './components/RulesView';
import LogsView from './components/LogsView';
import SubscriptionView from './components/SubscriptionView';
import SettingsView from './components/SettingsView';
import { UpdateDialog } from './components/UpdateDialog';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // 使用模块化的store
  const { addLog } = useLoggerStore();
  const { config, loading: configLoading, loadConfig } = useConfigStore();
  const { paths, loadPaths } = usePathsStore();
  const { stats, updateStatsFromPaths } = useStatsStore();

  const handleBatchOrganizeFiles = useCallback(async () => {
    // 这个函数现在只是占位符，实际的批量操作在 OrganizeView 中处理
    addLog('🔄 请在文件整理页面进行操作', 'info');
  }, [addLog]);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('Starting app initialization...');
      const initialized = await tauriAPI.initialize();
      console.log('Tauri initialized:', initialized);

      if (initialized) {
        try {
          const canUse = await tauriAPI.canUseApp();

          if (canUse) {
            addLog('✅ 应用已启动', 'success');
          } else {
            addLog('⚠️ 试用期已结束，请订阅后继续使用', 'warning');
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
            addLog(`📊 监控状态已更新`, 'info');
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
                `📁 文件已整理: ${event.payload.file_name} → ${event.payload.category}`,
                'success'
              );
            }
          );

          // 监听更新相关事件
          listen('update-available', (event: any) => {
            addLog('🔄 发现新版本可用', 'info');
            setShowUpdateDialog(true);
          });

        } catch (error) {
          addLog(`❌ 初始化失败: ${error?.message}`, 'error');
        }
      } else {
        addLog('❌ Tauri API初始化失败', 'error');
      }
    };

    initializeApp();
  }, [addLog, handleBatchOrganizeFiles, loadConfig, loadPaths]);

  // 当路径数据变化时，更新统计数据
  useEffect(() => {
    if (paths.length > 0) {
      updateStatsFromPaths(paths);
    }
  }, [paths, updateStatsFromPaths]);

  // 向后兼容的事件处理器（现在主要用于快捷键触发）
  const handleOrganizeFiles = async () => {
    await handleBatchOrganizeFiles();
  };

  const handleToggleMonitoring = async () => {
    // 计算监控路径数量
    const monitoringPathsCount = stats.pathStats
      ? Object.values(stats.pathStats).filter(
        (pathStat) => pathStat.monitoringSince !== null
      ).length
      : 0;
    addLog(`📊 当前监控状态: ${monitoringPathsCount} 个路径正在监控`, 'info');
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
            onOrganizeFiles={handleOrganizeFiles}
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
    <I18nProvider>
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
    </I18nProvider>
  );
}

export default App;
