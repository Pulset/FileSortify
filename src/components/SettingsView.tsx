import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLoggerStore } from '../stores';
import { UpdateDialog } from './UpdateDialog';

interface UpdateSchedulerConfig {
  enabled: boolean;
  check_interval_hours: number;
  auto_download: boolean;
  auto_install: boolean;
}

interface GeneralSettings {
  start_minimized: boolean;
  enable_notifications: boolean;
}

const SettingsView: React.FC = () => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { addLog } = useLoggerStore();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [appVersion, setAppVersion] = useState('加载中...');

  // 更新设置状态
  const [updateConfig, setUpdateConfig] = useState<UpdateSchedulerConfig>({
    enabled: true,
    check_interval_hours: 24,
    auto_download: false,
    auto_install: false,
  });
  // 通用设置状态
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    start_minimized: false,
    enable_notifications: true,
  });

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

    const loadUpdateConfig = async () => {
      try {
        const config = await invoke<UpdateSchedulerConfig>('get_scheduler_config');
        setUpdateConfig(config);
      } catch (error) {
        console.error('加载更新设置失败:', error);
      }
    };

    const loadGeneralSettings = async () => {
      try {
        // 这里假设有对应的后端接口，如果没有可以使用本地存储
        // const settings = await invoke<GeneralSettings>('get_general_settings');
        // setGeneralSettings(settings);
      } catch (error) {
        console.error('加载通用设置失败:', error);
      }
    };

    fetchAppVersion();
    loadUpdateConfig();
    loadGeneralSettings();
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

  const handleUpdateConfigChange = async (key: keyof UpdateSchedulerConfig, value: any) => {
    const newConfig = {
      ...updateConfig,
      [key]: value
    };
    setUpdateConfig(newConfig);

    // 直接保存到后端
    try {
      await invoke('update_scheduler_config', { config: newConfig });
      addLog('✅ 更新设置已保存', 'success');
    } catch (error) {
      addLog(`❌ 保存更新设置失败: ${error}`, 'error');
      console.error('保存更新设置失败:', error);
    }
  };

  const handleGeneralSettingsChange = async (key: keyof GeneralSettings, value: boolean) => {
    const newSettings = {
      ...generalSettings,
      [key]: value
    };
    setGeneralSettings(newSettings);

    // 直接保存到后端
    try {
      // 这里假设有对应的后端接口
      // await invoke('update_general_settings', { settings: newSettings });
      addLog('✅ 通用设置已保存', 'success');
    } catch (error) {
      addLog(`❌ 保存通用设置失败: ${error}`, 'error');
      console.error('保存通用设置失败:', error);
    }
  };

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>设置</h1>
        <p>管理应用程序设置和偏好</p>
      </div>

      <div className='settings-content' style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* 更新设置 */}
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-icon'>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <h3 className='setting-title'>更新设置</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 当前版本和检查更新 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>
                  当前版本
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {appVersion}
                </div>
              </div>
              <button
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdate}
                className='btn'
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                </svg>
                {isCheckingUpdate ? '检查中...' : '检查更新'}
              </button>
            </div>

            {/* 自动更新设置 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' }}>
                    启用自动检查更新
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    定期检查应用更新
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                  <input
                    type="checkbox"
                    checked={updateConfig.enabled}
                    onChange={(e) => handleUpdateConfigChange('enabled', e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: updateConfig.enabled ? '#007AFF' : '#ccc',
                    transition: '0.3s',
                    borderRadius: '24px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '',
                      height: '18px',
                      width: '18px',
                      left: updateConfig.enabled ? '23px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '0.3s',
                      borderRadius: '50%'
                    }}></span>
                  </span>
                </label>
              </div>

              {updateConfig.enabled && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '8px' }}>
                      检查更新间隔
                    </label>
                    <select
                      value={updateConfig.check_interval_hours}
                      onChange={(e) => handleUpdateConfigChange('check_interval_hours', parseInt(e.target.value))}
                      className='form-input'
                      style={{ maxWidth: '200px' }}
                    >
                      <option value={1}>每小时</option>
                      <option value={6}>每6小时</option>
                      <option value={12}>每12小时</option>
                      <option value={24}>每天</option>
                      <option value={168}>每周</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' }}>
                        自动下载更新
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        发现更新时自动下载
                      </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={updateConfig.auto_download}
                        onChange={(e) => handleUpdateConfigChange('auto_download', e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: updateConfig.auto_download ? '#007AFF' : '#ccc',
                        transition: '0.3s',
                        borderRadius: '24px'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '',
                          height: '18px',
                          width: '18px',
                          left: updateConfig.auto_download ? '23px' : '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          transition: '0.3s',
                          borderRadius: '50%'
                        }}></span>
                      </span>
                    </label>
                  </div>
                </>
              )}


            </div>
          </div>
        </div>

        {/* 通用设置 */}
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-icon'>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
              </svg>
            </div>
            <h3 className='setting-title'>通用设置</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' }}>
                  开机启动
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  系统启动时自动运行应用
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={generalSettings.start_minimized}
                  onChange={(e) => handleGeneralSettingsChange('start_minimized', e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: generalSettings.start_minimized ? '#007AFF' : '#ccc',
                  transition: '0.3s',
                  borderRadius: '24px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: generalSettings.start_minimized ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%'
                  }}></span>
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a1a1a', marginBottom: '2px' }}>
                  桌面通知
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  文件整理完成时显示通知
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={generalSettings.enable_notifications}
                  onChange={(e) => handleGeneralSettingsChange('enable_notifications', e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: generalSettings.enable_notifications ? '#007AFF' : '#ccc',
                  transition: '0.3s',
                  borderRadius: '24px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '',
                    height: '18px',
                    width: '18px',
                    left: generalSettings.enable_notifications ? '23px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: '0.3s',
                    borderRadius: '50%'
                  }}></span>
                </span>
              </label>
            </div>


          </div>
        </div>

        {/* 关于我们 */}
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-icon'>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2C13.1,2 14,2.9 14,4C14,5.1 13.1,6 12,6C10.9,6 10,5.1 10,4C10,2.9 10.9,2 12,2M21,9V7L15,1H5C3.89,1 3,1.89 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,9H14V4H5V21H19V9Z" />
              </svg>
            </div>
            <h3 className='setting-title'>关于我们</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 应用信息 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'linear-gradient(135deg, #007AFF, #0056CC)', borderRadius: '12px', color: 'white' }}>
              <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
                  FileSortify
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>
                  智能文件整理工具
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '2px' }}>
                  版本
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {appVersion}
                </div>
              </div>
            </div>

            {/* 应用介绍 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
                  产品介绍
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                  FileSortify 是一个智能的文件自动分类工具，可以根据文件类型自动整理您的文件。
                  支持自定义分类规则，实时监控文件变化，让您的文件管理更加高效。
                </div>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
                  主要功能
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    '🗂️ 智能文件分类',
                    '⚡ 实时文件监控',
                    '🎯 自定义分类规则',
                    '📊 详细统计报告',
                    '🔔 桌面通知提醒'
                  ].map((feature, index) => (
                    <div key={index} style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
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
