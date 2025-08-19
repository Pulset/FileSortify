import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../contexts/I18nContext';

interface UpdateSchedulerConfig {
  enabled: boolean;
  check_interval_hours: number;
  auto_download: boolean;
  auto_install: boolean;
}

export const UpdateSettings: React.FC = () => {
  const [config, setConfig] = useState<UpdateSchedulerConfig>({
    enabled: false,
    check_interval_hours: 24,
    auto_download: false,
    auto_install: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const serverConfig = await invoke<UpdateSchedulerConfig>(
        'get_scheduler_config'
      );
      setConfig(serverConfig);
    } catch (error) {
      console.error('Failed to load update config:', error);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await invoke('update_scheduler_config', { config });
      setSaveMessage(t('settings.saveSuccess'));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage(t('settings.saveFailed'));
      console.error('Failed to save update config:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfigChange = (key: keyof UpdateSchedulerConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className='bg-white rounded-lg shadow p-6'>
      <h3 className='text-lg font-semibold mb-4'>
        {t('settings.update.title')}
      </h3>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <label className='text-sm font-medium text-gray-700'>
            {t('settings.update.enableAutoCheck')}
          </label>
          <input
            type='checkbox'
            checked={config.enabled}
            onChange={(e) => handleConfigChange('enabled', e.target.checked)}
            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
          />
        </div>

        {config.enabled && (
          <>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                {t('settings.update.checkInterval')}
              </label>
              <select
                value={config.check_interval_hours}
                onChange={(e) =>
                  handleConfigChange(
                    'check_interval_hours',
                    parseInt(e.target.value)
                  )
                }
                className='w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value={1}>
                  {t('settings.update.intervals.hourly')}
                </option>
                <option value={6}>
                  {t('settings.update.intervals.sixHours')}
                </option>
                <option value={12}>
                  {t('settings.update.intervals.twelveHours')}
                </option>
                <option value={24}>
                  {t('settings.update.intervals.daily')}
                </option>
                <option value={168}>
                  {t('settings.update.intervals.weekly')}
                </option>
              </select>
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  {t('settings.update.autoDownload')}
                </label>
                <p className='text-xs text-gray-500'>
                  {t('settings.update.autoDownloadDesc')}
                </p>
              </div>
              <input
                type='checkbox'
                checked={config.auto_download}
                onChange={(e) =>
                  handleConfigChange('auto_download', e.target.checked)
                }
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
              />
            </div>

            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700'>
                  {t('settings.update.autoInstall')}
                </label>
                <p className='text-xs text-gray-500'>
                  {t('settings.update.autoInstallDesc')}
                </p>
              </div>
              <input
                type='checkbox'
                checked={config.auto_install}
                onChange={(e) =>
                  handleConfigChange('auto_install', e.target.checked)
                }
                disabled={!config.auto_download}
                className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50'
              />
            </div>
          </>
        )}

        <div className='flex items-center gap-3 pt-4 border-t'>
          <button
            onClick={saveConfig}
            disabled={isSaving}
            className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50'
          >
            {isSaving ? t('common.saving') : t('settings.update.saveSettings')}
          </button>

          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.includes(t('settings.saveFailed'))
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}
            >
              {saveMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
