import { useState, useEffect } from 'react';
import { ViewType } from './types';
import { tauriAPI } from './utils/tauri';
import { useLogger } from './contexts/LoggerContext';
import { useConfig } from './hooks/useConfig';
import { useStats } from './hooks/useStats';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import OrganizeView from './components/OrganizeView';
import RulesView from './components/RulesView';
import LogsView from './components/LogsView';
import SubscriptionView from './components/SubscriptionView';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [folderPath, setFolderPath] = useState('');

  const { addLog } = useLogger();
  const { config, loading: configLoading, loadConfig } = useConfig();
  const { stats, updateFilesOrganized, setMonitoring } = useStats();

  useEffect(() => {
    const initializeApp = async () => {
      const initialized = await tauriAPI.initialize();

      if (initialized) {
        try {
          const canUse = await tauriAPI.canUseApp();

          if (canUse) {
            addLog('✅ 应用已启动', 'success');
          } else {
            addLog('⚠️ 试用期已结束，请订阅后继续使用', 'warning');
          }

          // 加载默认文件夹
          try {
            const defaultFolder = await tauriAPI.getDefaultDownloadsFolder();
            setFolderPath(defaultFolder);
          } catch (error) {
            console.log('无法获取默认下载文件夹:', error);
          }

          // 设置事件监听器
          tauriAPI.listen('organize-files', () => {
            handleOrganizeFiles();
          });

          tauriAPI.listen('toggle-monitoring', () => {
            handleToggleMonitoring();
          });

          // 监听文件整理事件来更新统计数据
          tauriAPI.listen(
            'file-organized',
            (event: {
              payload: {
                file_name: string;
                category: string;
                timestamp: string;
              };
            }) => {
              console.log(event);
              updateFilesOrganized(1);
            }
          );

          // 现在加载配置
          loadConfig();
        } catch (error) {
          addLog(`❌ 初始化失败: ${error}`, 'error');
        }
      } else {
        addLog('❌ Tauri API初始化失败', 'error');
      }
    };

    initializeApp();
  }, []);

  const handleOrganizeFiles = async () => {
    if (!folderPath.trim()) {
      alert('请先选择文件夹');
      return;
    }

    try {
      // 检查订阅状态
      const canUse = await tauriAPI.canUseApp();
      if (!canUse) {
        alert('文件整理功能需要有效订阅。请先订阅后再使用。');
        return;
      }

      addLog('🔄 开始整理现有文件...', 'info');
      const result = await tauriAPI.organizeFiles(folderPath);

      const fileCount = parseInt(result.match(/\d+/)?.[0] || '0');
      updateFilesOrganized(fileCount);

      addLog(`✅ ${result}`, 'success');

      // 发送通知
      await tauriAPI.sendNotification('文件整理完成', result);
    } catch (error) {
      addLog(`❌ 整理失败: ${error}`, 'error');
      alert(`整理失败: ${error}`);
    }
  };

  const handleToggleMonitoring = async () => {
    console.log('handleToggleMonitoring called, folderPath:', folderPath);

    if (!folderPath.trim()) {
      alert('请先选择文件夹');
      addLog('❌ 请先选择文件夹', 'error');
      return;
    }

    try {
      addLog('🔄 正在检查订阅状态...', 'info');

      // 检查订阅状态
      const canUse = await tauriAPI.canUseApp();
      console.log('canUse result:', canUse);

      if (!canUse) {
        alert('文件监控功能需要有效订阅。请先订阅后再使用。');
        addLog('❌ 文件监控功能需要有效订阅', 'error');
        return;
      }

      addLog('🔄 正在切换监控状态...', 'info');
      const result = await tauriAPI.toggleMonitoring(folderPath);
      console.log('toggleMonitoring result:', result);

      setIsMonitoring(result);
      setMonitoring(result);

      if (result) {
        addLog('🔍 开始监控新文件...', 'success');
      } else {
        addLog('⏹️ 已停止监控', 'info');
      }
    } catch (error) {
      console.error('handleToggleMonitoring error:', error);
      addLog(`❌ 切换监控失败: ${error}`, 'error');
      alert(`操作失败: ${error}`);
    }
  };

  const handleSelectFolder = async () => {
    try {
      addLog('📁 正在打开文件夹选择对话框...', 'info');
      const folder = await tauriAPI.selectFolder();

      if (folder) {
        setFolderPath(folder);
        addLog(`📁 已选择文件夹: ${folder}`, 'success');
      } else {
        addLog('📁 文件夹选择已取消', 'info');
      }
    } catch (error) {
      addLog(`❌ 选择文件夹失败: ${error}`, 'error');
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            stats={stats}
            isMonitoring={isMonitoring}
            onOrganizeFiles={handleOrganizeFiles}
            onToggleMonitoring={handleToggleMonitoring}
          />
        );
      case 'organize':
        return (
          <OrganizeView
            folderPath={folderPath}
            onFolderPathChange={setFolderPath}
            onSelectFolder={handleSelectFolder}
            onOrganizeFiles={handleOrganizeFiles}
            onToggleMonitoring={handleToggleMonitoring}
            isMonitoring={isMonitoring}
          />
        );
      case 'rules':
        return <RulesView config={config} loading={configLoading} />;
      case 'logs':
        return <LogsView />;
      case 'subscription':
        return <SubscriptionView />;
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
    </div>
  );
}

export default App;
