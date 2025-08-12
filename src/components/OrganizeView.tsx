import React, { useState } from 'react';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { usePathsStore, useLoggerStore } from '../stores';
import { tauriAPI } from '../utils/tauri';

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
      console.error('选择文件夹失败:', error?.message);
    }
  };

  const handleAddPath = async () => {
    if (!newPathInput.trim()) {
      await message('请先选择文件夹路径', {
        title: '提示',
        kind: 'warning',
      });
      return;
    }

    try {
      await addPath(newPathInput, newPathName || undefined);
      addLog(`✅ 已添加路径: ${newPathName || '新路径'} (${newPathInput})`);
      setNewPathInput('');
      setNewPathName('');
      setShowAddForm(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : error
      addLog(`❌ 添加路径失败: ${msg}`, 'error');
      await message(`添加路径失败: ${msg}`, {
        title: '错误',
        kind: 'error',
      });
    }
  };

  const handleRemovePath = async (pathId: string) => {
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;

    const confirmed = await ask(`确定要删除路径 "${path.name}" 吗？`, {
      title: '确认删除',
      kind: 'warning',
    });

    if (confirmed) {
      try {
        await removePath(pathId);
        addLog(`✅ 已删除路径: ${path.name}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : error
        addLog(`❌ 删除路径失败: ${msg}`, 'error');
        await message(`删除路径失败: ${msg}`, {
          title: '错误',
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
      addLog(`✅ 已更新路径名称: ${editName.trim()}`);
      setEditingPath(null);
      setEditName('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : error
      addLog(`❌ 更新路径名称失败: ${msg}`, 'error');
      await message(`更新路径名称失败: ${msg}`, {
        title: '错误',
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
        addLog(`🔍 开始监控: ${path.name}`, 'success');
      } else {
        addLog(`⏹️ 停止监控: ${path.name}`, 'info');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : error
      addLog(`❌ 切换监控状态失败: ${msg}`, 'error');
      await message(`切换监控状态失败: ${msg}`, {
        title: '错误',
        kind: 'error',
      });
    }
  };

  const handleOrganizeFiles = async (pathId: string) => {
    const path = paths.find((p) => p.id === pathId);
    if (!path) return;

    try {
      addLog(`🔄 开始整理文件: ${path.name}...`, 'info');
      const fileCount = await organizePathFiles(pathId);
      addLog(`✅ ${path.name}: 整理了 ${fileCount} 个文件`, 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : error
      addLog(`❌ 整理失败 (${path.name}): ${msg}`, 'error');
      await message(`整理文件失败: ${msg}`, {
        title: '错误',
        kind: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className='view active'>
        <div className='loading'>
          <div className='spinner'></div>
          加载路径配置中...
        </div>
      </div>
    );
  }

  console.log('paths', paths);
  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>文件整理</h1>
        <p>管理多个文件夹路径，每个路径都可以独立整理和监控</p>
      </div>

      {/* 添加新路径区域 */}
      <div className='settings-section'>
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-title'>添加新路径</div>
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
                添加文件夹路径
              </button>
            ) : (
              <div className='add-path-form'>
                <div className='input-group'>
                  <input
                    type='text'
                    value={newPathInput}
                    onChange={(e) => setNewPathInput(e.target.value)}
                    className='path-input form-input'
                    placeholder='文件夹路径'
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
                    选择文件夹
                  </button>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <input
                    type='text'
                    value={newPathName}
                    onChange={(e) => setNewPathName(e.target.value)}
                    className='form-input'
                    placeholder='路径名称（可选）'
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
                    添加
                  </button>
                  <button
                    className='btn secondary'
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPathInput('');
                      setNewPathName('');
                    }}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 路径列表 */}
      <div className='settings-section'>
        <div className='section-title'>已配置的路径 ({paths.length})</div>

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
                style={{ marginBottom: '16px', opacity: 0.5 }}
              >
                <path d='M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z' />
              </svg>
              <p>暂无配置的路径</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>
                点击上方"添加文件夹路径"开始配置
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
                            保存
                          </button>
                          <button
                            className='btn secondary'
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                            onClick={handleCancelEdit}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className='path-name'>{path.name}</h4>
                        <button
                          className='edit-name-btn'
                          onClick={() => handleEditName(path.id, path.name)}
                          title='编辑名称'
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
                      className={`status-badge ${path.isMonitoring ? 'monitoring' : 'stopped'
                        }`}
                    >
                      {path.isMonitoring ? '监控中' : '已停止'}
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
                    <span className='stat-label'>已整理文件:</span>
                    <span className='stat-value'>
                      {path.stats.filesOrganized}
                    </span>
                  </div>
                  <div className='stat-item'>
                    <span className='stat-label'>最后整理:</span>
                    <span className='stat-value'>
                      {path.stats.lastOrganized || '从未整理'}
                    </span>
                  </div>
                  {path.stats.monitoringSince && (
                    <div className='stat-item'>
                      <span className='stat-label'>监控开始:</span>
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
                    整理文件
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
                    {path.isMonitoring ? '停止监控' : '开始监控'}
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
                    删除
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
