import React, { useState } from 'react';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { usePathsStore, useLoggerStore } from '../stores';
import { tauriAPI } from '../utils/tauri';
import { useI18n } from '../contexts/I18nContext';

interface OrganizeViewProps {
  // 保持接口兼容性，但这些参数将不再使用
  folderPath?: string;
  onFolderPathChange?: (path: string) => void;
  onSelectFolder?: () => void;
  onOrganizeFiles?: () => void;
  onToggleMonitoring?: () => void;
  isMonitoring?: boolean;
}

const OrganizeView: React.FC<OrganizeViewProps> = () => {
  const {
    paths,
    loading,
    addPath,
    removePath,
    updatePath,
    togglePathMonitoring,
    organizePathFiles,
  } = usePathsStore();

  const { addLog } = useLoggerStore();
  const { t } = useI18n();

  const [newPathInput, setNewPathInput] = useState('');
  const [newPathName, setNewPathName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSelectFolder = async () => {
    try {
      const folder = await tauriAPI.selectFolder();
      if (folder) {
        setNewPathInput(folder);
      }
    } catch (error) {
      console.error(
        '选择文件夹失败:',
        error instanceof Error ? error.message : error
      );
    }
  };

  const handleAddPath = async () => {
    if (!newPathInput.trim()) {
      await message(t('errors.selectFolderFirst'), {
        title: t('common.error'),
        kind: 'warning',
      });
      return;
    }

    try {
      await addPath(newPathInput, newPathName || undefined);
      addLog(
        `✅ ${t('organize.pathAdded', {
          name: newPathName || t('organize.newPath'),
          path: newPathInput,
        })}`
      );
      setNewPathInput('');
      setNewPathName('');
      setShowAddForm(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : error;
      addLog(`❌ ${t('errors.addCategoryFailed')}: ${msg}`, 'error');
      await message(`${t('errors.addCategoryFailed')}: ${msg}`, {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const handleRemovePath = async (pathId: string) => {
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;

    const confirmed = await ask(
      t('organize.confirmDeletePath', { name: path.name }),
      {
        title: t('organize.confirmDelete'),
        kind: 'warning',
      }
    );

    if (confirmed) {
      try {
        // 如果当前路径已开启监控，先关闭监控
        if (path.isMonitoring) {
          try {
            await togglePathMonitoring(pathId);
          } catch (err) {
            // 关闭监控失败也允许继续删除，但给出提示
            const msg = err instanceof Error ? err.message : err;
            addLog(
              `⚠️ ${t('errors.monitoringToggleFailed')}: ${msg}`,
              'warning'
            );
          }
        }
        await removePath(pathId);
        addLog(`✅ ${t('organize.pathDeleted', { name: path.name })}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : error;
        addLog(`❌ ${t('errors.deleteCategoryFailed')}: ${msg}`, 'error');
        await message(`${t('errors.deleteCategoryFailed')}: ${msg}`, {
          title: t('common.error'),
          kind: 'error',
        });
      }
    }
  };

  const handleEditName = (pathId: string, currentName: string) => {
    setEditingPath(pathId);
    setEditName(currentName);
  };

  const handleSaveEdit = async () => {
    if (!editingPath || !editName.trim()) return;

    try {
      await updatePath(editingPath, { name: editName.trim() });
      addLog(`✅ ${t('organize.pathNameUpdated', { name: editName.trim() })}`);
      setEditingPath(null);
      setEditName('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : error;
      addLog(`❌ ${t('errors.addExtensionFailed')}: ${msg}`, 'error');
      await message(`${t('errors.addExtensionFailed')}: ${msg}`, {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingPath(null);
    setEditName('');
  };

  const handleToggleMonitoring = async (pathId: string) => {
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;

    try {
      const newState = await togglePathMonitoring(pathId);
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : error;
      addLog(`❌ ${t('errors.monitoringToggleFailed')}: ${msg}`, 'error');
      await message(`${t('errors.monitoringToggleFailed')}: ${msg}`, {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

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

  if (loading) {
    return (
      <div className='view active'>
        <div className='loading'>
          <div className='spinner'></div>
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>{t('organize.title')}</h1>
        <p>{t('organize.description')}</p>
      </div>

      {/* 添加新路径区域 */}
      <div className='settings-section'>
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-title'>{t('organize.addNewPath')}</div>
          </div>
          <div className='setting-content'>
            {!showAddForm ? (
              <button className='btn' onClick={() => setShowAddForm(true)}>
                <svg
                  width='16'
                  height='16'
                  viewBox='0 0 24 24'
                  fill='currentColor'
                >
                  <path d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' />
                </svg>
                {t('organize.addFolderPath')}
              </button>
            ) : (
              <div className='add-path-form'>
                <div className='input-group'>
                  <input
                    type='text'
                    value={newPathInput}
                    onChange={(e) => setNewPathInput(e.target.value)}
                    className='path-input form-input'
                    placeholder={t('organize.folderPath')}
                  />
                  <button
                    className='select-btn btn secondary'
                    onClick={handleSelectFolder}
                  >
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path d='M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z' />
                    </svg>
                    {t('organize.selectFolder')}
                  </button>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <input
                    type='text'
                    value={newPathName}
                    onChange={(e) => setNewPathName(e.target.value)}
                    className='form-input'
                    placeholder={t('organize.pathName')}
                  />
                </div>
                <div className='action-section' style={{ marginTop: '16px' }}>
                  <button className='btn' onClick={handleAddPath}>
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
                    </svg>
                    {t('common.add')}
                  </button>
                  <button
                    className='btn secondary'
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPathInput('');
                      setNewPathName('');
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 路径列表 */}
      <div className='settings-section'>
        <div className='section-title'>
          {t('organize.configuredPaths')} ({paths.length})
        </div>

        {paths.length === 0 ? (
          <div className='setting-card'>
            <div
              style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}
            >
              <svg
                width='48'
                height='48'
                viewBox='0 0 24 24'
                fill='currentColor'
                style={{ margin: '16px auto', opacity: 0.5 }}
              >
                <path d='M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z' />
              </svg>
              <p>{t('organize.noPathsConfigured')}</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                {t('organize.clickToAddPath')}
              </p>
            </div>
          </div>
        ) : (
          <div className='paths-grid'>
            {paths.map((path) => (
              <div key={path.id} className='path-card'>
                <div className='path-header'>
                  <div className='path-info'>
                    {editingPath === path.id ? (
                      <div className='edit-name-form'>
                        <input
                          type='text'
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className='form-input'
                          style={{ fontSize: '14px', padding: '6px 8px' }}
                        />
                        <div className='edit-actions'>
                          <button
                            className='btn'
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                            onClick={handleSaveEdit}
                          >
                            {t('common.save')}
                          </button>
                          <button
                            className='btn secondary'
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                            onClick={handleCancelEdit}
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className='path-name'>{path.name}</h4>
                        <button
                          className='edit-name-btn'
                          onClick={() => handleEditName(path.id, path.name)}
                          title={t('organize.editName')}
                        >
                          <svg
                            width='14'
                            height='14'
                            viewBox='0 0 24 24'
                            fill='currentColor'
                          >
                            <path d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  <div className='path-status'>
                    <span
                      className={`status-badge ${
                        path.isMonitoring ? 'monitoring' : 'stopped'
                      }`}
                    >
                      {path.isMonitoring
                        ? t('organize.monitoring')
                        : t('organize.stopped')}
                    </span>
                  </div>
                </div>

                <div className='path-details'>
                  <p className='path-location' title={path.path}>
                    {path.path}
                  </p>
                </div>

                <div className='path-stats'>
                  <div className='stat-item'>
                    <span className='stat-label'>
                      {t('organize.filesOrganized')}:
                    </span>
                    <span className='stat-value'>
                      {path.stats.filesOrganized}
                    </span>
                  </div>
                  <div className='stat-item'>
                    <span className='stat-label'>
                      {t('organize.lastOrganized')}:
                    </span>
                    <span className='stat-value'>
                      {path.stats.lastOrganized || t('organize.neverOrganized')}
                    </span>
                  </div>
                  {path.stats.monitoringSince && (
                    <div className='stat-item'>
                      <span className='stat-label'>
                        {t('organize.monitoringStarted')}:
                      </span>
                      <span className='stat-value'>
                        {path.stats.monitoringSince}
                      </span>
                    </div>
                  )}
                </div>

                <div className='path-actions'>
                  <button
                    className='btn'
                    onClick={() => handleOrganizeFiles(path.id)}
                  >
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path d='M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z' />
                    </svg>
                    {t('organize.organizeFiles')}
                  </button>

                  <button
                    className={`btn ${path.isMonitoring ? 'secondary' : ''}`}
                    onClick={() => handleToggleMonitoring(path.id)}
                  >
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path
                        d={
                          path.isMonitoring
                            ? 'M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z'
                            : 'M1 12c0 6 5 11 11 11s11-5 11-11S18 1 12 1 1 6 1 12zm15.7-1.6l-1.4-1.4-3.3 3.3-1.4-1.4-1.4 1.4 2.8 2.8 4.7-4.7z'
                        }
                      />
                    </svg>
                    {path.isMonitoring
                      ? t('organize.stopMonitoring')
                      : t('organize.startMonitoring')}
                  </button>

                  <button
                    className='btn danger'
                    onClick={() => handleRemovePath(path.id)}
                  >
                    <svg
                      width='16'
                      height='16'
                      viewBox='0 0 24 24'
                      fill='currentColor'
                    >
                      <path d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' />
                    </svg>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizeView;
