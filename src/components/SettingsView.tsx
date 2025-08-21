import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLoggerStore } from '../stores';
import { UpdateDialog } from './UpdateDialog';
import { tauriAPI } from '../utils/tauri';
import { GeneralSettings } from '../types';
import { useI18n, Language } from '../contexts/I18nContext';

interface UpdateSchedulerConfig {
  enabled: boolean;
  check_interval_hours: number;
  auto_download: boolean;
  auto_install: boolean;
}

const SettingsView: React.FC = () => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { addLog } = useLoggerStore();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const { t, language, setLanguage } = useI18n();

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Update settings state
  const [updateConfig, setUpdateConfig] = useState<UpdateSchedulerConfig>({
    enabled: false,
    check_interval_hours: 24,
    auto_download: false,
    auto_install: false,
  });
  // General settings state
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    auto_start: false,
    theme: 'system',
  });

  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const version = await invoke<string>('get_app_version');
        setAppVersion(version);
      } catch (error) {
        console.error('Failed to get app version:', error);
        setAppVersion(t('common.error'));
      }
    };

    const loadUpdateConfig = async () => {
      try {
        const config = await invoke<UpdateSchedulerConfig>(
          'get_scheduler_config'
        );
        setUpdateConfig(config);
      } catch (error) {
        console.error('Failed to load update config:', error);
        addLog(`❌ ${t('errors.loadConfigFailed')}: ${error}`, 'error');
      }
    };

    const loadGeneralSettings = async () => {
      try {
        const settings = await tauriAPI.getGeneralSettings();
        setGeneralSettings(settings);
      } catch (error) {
        console.error('Failed to load general settings:', error);
        addLog(`❌ ${t('errors.loadConfigFailed')}`, 'error');
      }
    };

    // Load all configurations in parallel
    const loadAllSettings = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchAppVersion(),
          loadUpdateConfig(),
          loadGeneralSettings(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllSettings();
  }, []);

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const updateStatus = await invoke<{
        available: boolean;
        latest_version?: string;
      }>('check_update');
      if (updateStatus.available) {
        addLog(
          `🔄 ${t('updateDialog.newVersion')} ${updateStatus.latest_version}`,
          'info'
        );
        setShowUpdateDialog(true);
      } else {
        addLog(`✅ ${t('updateDialog.updateComplete')}`, 'success');
      }
    } catch (error) {
      addLog(`❌ ${t('updateDialog.updateFailed')}: ${error}`, 'error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleUpdateConfigChange = async (
    key: keyof UpdateSchedulerConfig,
    value: any
  ) => {
    const newConfig = {
      ...updateConfig,
      [key]: value,
    };
    setUpdateConfig(newConfig);

    // Save directly to backend
    try {
      await invoke<string>('update_scheduler_config', { config: newConfig });
      addLog(`✅ ${t('settings.saveSuccess')}`, 'success');
    } catch (error) {
      addLog(`❌ ${t('settings.saveFailed')}: ${error}`, 'error');
      console.error('Failed to save update config:', error);
      // Rollback state
      setUpdateConfig(updateConfig);
    }
  };

  const handleGeneralSettingsChange = async (
    key: keyof GeneralSettings,
    value: boolean | string
  ) => {
    const newSettings = {
      ...generalSettings,
      [key]: value,
    };
    setGeneralSettings(newSettings);

    // Save directly to backend
    try {
      await tauriAPI.updateGeneralSettings(newSettings);
      addLog(`✅ ${t('settings.saveSuccess')}`, 'success');
    } catch (error) {
      addLog(`❌ ${t('settings.saveFailed')}: ${error}`, 'error');
      console.error('Failed to save general settings:', error);
      // Rollback state
      setGeneralSettings(generalSettings);
    }
  };

  // Loading component
  const LoadingSpinner = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: '#6b7280',
      }}
    >
      <svg
        width='20'
        height='20'
        viewBox='0 0 24 24'
        fill='none'
        style={{
          animation: 'spin 1s linear infinite',
          marginRight: '8px',
        }}
      >
        <circle
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
          strokeDasharray='31.416'
          strokeDashoffset='31.416'
          style={{
            animation: 'dash 2s ease-in-out infinite',
          }}
        />
      </svg>
      <span style={{ fontSize: '14px' }}>{t('common.loading')}</span>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes dash {
            0% {
              stroke-dasharray: 1, 150;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 150;
              stroke-dashoffset: -35;
            }
            100% {
              stroke-dasharray: 90, 150;
              stroke-dashoffset: -124;
            }
          }
        `}
      </style>
    </div>
  );

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </div>

      <div
        className='settings-content'
        style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
      >
        {/* Update Settings */}
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-icon'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' />
              </svg>
            </div>
            <h3 className='setting-title'>{t('settings.update.title')}</h3>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              {/* Current version and check for updates */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1a1a1a',
                      marginBottom: '4px',
                    }}
                  >
                    {t('settings.update.currentVersion')}
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
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='currentColor'
                  >
                    <path d='M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z' />
                  </svg>
                  {isCheckingUpdate
                    ? t('settings.update.checking')
                    : t('settings.update.checkForUpdates')}
                </button>
              </div>

              {/* Auto update settings */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#1a1a1a',
                        marginBottom: '2px',
                      }}
                    >
                      {t('settings.update.enableAutoCheck')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {t('settings.update.enableAutoCheckDesc')}
                    </div>
                  </div>
                  <label
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: '44px',
                      height: '24px',
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={updateConfig.enabled}
                      onChange={(e) =>
                        handleUpdateConfigChange('enabled', e.target.checked)
                      }
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: updateConfig.enabled
                          ? '#007AFF'
                          : '#ccc',
                        transition: '0.3s',
                        borderRadius: '24px',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          content: '',
                          height: '18px',
                          width: '18px',
                          left: updateConfig.enabled ? '23px' : '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          transition: '0.3s',
                          borderRadius: '50%',
                        }}
                      ></span>
                    </span>
                  </label>
                </div>

                {updateConfig.enabled && (
                  <>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1a1a1a',
                          marginBottom: '8px',
                        }}
                      >
                        {t('settings.update.checkInterval')}
                      </label>
                      <select
                        value={updateConfig.check_interval_hours}
                        onChange={(e) =>
                          handleUpdateConfigChange(
                            'check_interval_hours',
                            parseInt(e.target.value)
                          )
                        }
                        className='form-input'
                        style={{ maxWidth: '200px' }}
                      >
                        <option value={24}>
                          {t('settings.update.intervals.daily')}
                        </option>
                        <option value={168}>
                          {t('settings.update.intervals.weekly')}
                        </option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* General Settings */}
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-icon'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z' />
              </svg>
            </div>
            <h3 className='setting-title'>{t('settings.general.title')}</h3>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              {/* Language settings */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1a1a1a',
                      marginBottom: '2px',
                    }}
                  >
                    {t('settings.general.language')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {t('settings.general.languageDesc')}
                  </div>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className='form-input'
                  style={{ maxWidth: '120px' }}
                >
                  <option value='en'>English</option>
                  <option value='zh'>中文</option>
                </select>
              </div>

              {/* Auto start */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1a1a1a',
                      marginBottom: '2px',
                    }}
                  >
                    {t('settings.general.autoStart')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {t('settings.general.autoStartDesc')}
                  </div>
                </div>
                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '44px',
                    height: '24px',
                  }}
                >
                  <input
                    type='checkbox'
                    checked={generalSettings.auto_start}
                    onChange={(e) =>
                      handleGeneralSettingsChange(
                        'auto_start',
                        e.target.checked
                      )
                    }
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: generalSettings.auto_start
                        ? '#007AFF'
                        : '#ccc',
                      transition: '0.3s',
                      borderRadius: '24px',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '',
                        height: '18px',
                        width: '18px',
                        left: generalSettings.auto_start ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '0.3s',
                        borderRadius: '50%',
                      }}
                    ></span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* About */}
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-icon'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M12,2C13.1,2 14,2.9 14,4C14,5.1 13.1,6 12,6C10.9,6 10,5.1 10,4C10,2.9 10.9,2 12,2M21,9V7L15,1H5C3.89,1 3,1.89 3,3V21A2,2 0 0,0 5,23H19A2,2 0 0,0 21,21V9M19,9H14V4H5V21H19V9Z' />
              </svg>
            </div>
            <h3 className='setting-title'>{t('settings.about.title')}</h3>
          </div>

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {/* App information */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '20px',
                background: 'linear-gradient(135deg, #007AFF, #0056CC)',
                borderRadius: '12px',
                color: 'white',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img src='../../app-icon.png' alt='' />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    marginBottom: '4px',
                  }}
                >
                  FileSortify
                </div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>
                  {t('settings.about.subtitle')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '12px',
                    opacity: 0.8,
                    marginBottom: '2px',
                  }}
                >
                  {t('settings.update.currentVersion')}
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>
                  {appVersion}
                </div>
              </div>
            </div>

            {/* App introduction */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '8px',
                  }}
                >
                  {t('settings.about.productIntro')}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    lineHeight: '1.6',
                  }}
                >
                  {t('settings.about.productIntroDesc')}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '8px',
                  }}
                >
                  {t('settings.about.mainFeatures')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {[
                    t('settings.about.features.smartClassification'),
                    t('settings.about.features.realTimeMonitoring'),
                    t('settings.about.features.customRules'),
                    t('settings.about.features.detailedReports'),
                    // t('settings.about.features.desktopNotifications'),
                  ].map((feature, index) => (
                    <div
                      key={index}
                      style={{
                        fontSize: '13px',
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '8px',
                  }}
                >
                  {t('settings.about.contactUs')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <a href='mailto:support@picasso-designs.com'>
                      support@picasso-designs.com
                    </a>
                  </div>
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
