import React, { useState, useEffect } from 'react';
import { UpdateSettings } from './UpdateSettings';
import { invoke } from '@tauri-apps/api/core';
import { useLoggerStore } from '../stores';
import { UpdateDialog } from './UpdateDialog';
const SettingsView: React.FC = () => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { addLog } = useLoggerStore();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [appVersion, setAppVersion] = useState('加载中...');

  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const version = await invoke<string>('get_app_version');
        setAppVersion(version);
      } catch (error) {
        console.error('获取应用版本失败:', error);
        setAppVersion('未知');
      }
    };

    fetchAppVersion();
  }, []);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const updateStatus = await invoke<{ available: boolean; latest_version?: string }>('check_update');
      if (updateStatus.available) {
        addLog(`🔄 发现新版本 ${updateStatus.latest_version}`, 'info');
        setShowUpdateDialog(true);
      } else {
        addLog('✅ 已是最新版本', 'success');
      }
    } catch (error) {
      addLog(`❌ 检查更新失败: ${error}`, 'error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>设置</h1>
        <p>管理应用程序设置和偏好</p>
      </div>

      <div
        className='settings-content'
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {/* 应用信息卡片 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h3 className='text-lg font-semibold mb-4'>应用信息</h3>
          <div className='space-y-3'>
            <div className='flex justify-between items-center'>
              <span className='text-sm font-medium text-gray-700'>版本</span>
              <span className='text-sm text-gray-600'>{appVersion}</span>
            </div>

            <div className='pt-3 border-t'>
              <button
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdate}
                className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50'
              >
                {isCheckingUpdate ? '检查中...' : '检查更新'}
              </button>
            </div>
          </div>
        </div>

        {/* 更新设置 */}
        <UpdateSettings />

        {/* 其他设置可以在这里添加 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h3 className='text-lg font-semibold mb-4'>通用设置</h3>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  启动时最小化到系统托盘
                </label>
                <p className='text-xs text-gray-500'>
                  应用启动时自动隐藏到系统托盘
                </p>
              </div>
              <input
                type='checkbox'
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  启用桌面通知
                </label>
                <p className='text-xs text-gray-500'>文件整理完成时显示通知</p>
              </div>
              <input
                type='checkbox'
                defaultChecked
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
              />
            </div>
          </div>
        </div>

        {/* 关于 */}
        <div className='bg-white rounded-lg shadow p-6'>
          <h3 className='text-lg font-semibold mb-4'>关于 File Sortify</h3>
          <div className='text-sm text-gray-600 space-y-2'>
            <p>
              File Sortify
              是一个智能的文件自动分类工具，可以根据文件类型自动整理您的文件。
            </p>
            <p>
              支持自定义分类规则，实时监控文件变化，让您的文件管理更加高效。
            </p>
            <div className='pt-3 border-t mt-4'>
              <p className='text-xs text-gray-500'>
                © 2024 File Sortify. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
      <UpdateDialog
        isOpen={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
      />
    </div>
  );
};

export default SettingsView;
