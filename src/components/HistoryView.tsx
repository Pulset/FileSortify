import React, { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { invoke } from '@tauri-apps/api/core';
import { message, ask } from '@tauri-apps/plugin-dialog';
import { useHistoryStore, usePathsStore } from '../stores';
import { FileHistoryEntry } from '../stores/historyStore';
import { useLoggerStore } from '../stores';

const HistoryView: React.FC = () => {
  const { t } = useI18n();
  const { entries, clearHistory, getHistoryEntries, removeHistoryEntry } =
    useHistoryStore();
  const { paths } = usePathsStore();
  const { addLog } = useLoggerStore();
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const handleUndo = async (action: FileHistoryEntry) => {
    // 检查是否有监控正在运行
    const isAnyMonitoring = paths.some((path) => path.isMonitoring);
    if (isAnyMonitoring) {
      await message(t('history.stopMonitoringRequired'), {
        title: t('common.error'),
        kind: 'warning',
      });
      return;
    }

    // 确认撤销操作
    const confirmed = await ask(t('history.confirmUndo'), {
      title: t('history.undoAction'),
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      setUndoingId(action.id);

      // 记录开始撤销的日志
      addLog(
        `🔄 ${t('history.undoStarted')}: ${action.file_name} (${
          action.category
        })`,
        'info'
      );

      // 直接使用 Rust 的 std::fs 进行文件移动操作，支持自动重命名
      const result = await invoke<string>('move_file_direct', {
        sourcePath: action.moved_to_path,
        targetPath: action.original_path,
      });

      // 从历史记录中移除已撤销的项目
      removeHistoryEntry(action.id);

      // 检查是否发生了重命名
      const originalPath = action.original_path;
      if (result.includes(' -> ') && !result.includes(originalPath)) {
        // 文件被重命名了，提取实际的目标路径
        const actualPath = result.split(' -> ')[1];

        // 记录重命名撤销成功的日志
        addLog(
          `✅ ${t('history.undoSuccessLog')}: ${
            action.file_name
          } → ${actualPath}`,
          'success'
        );

        await message(
          `${t('history.undoSuccessRenamed')}

${t('history.actualLocation')}: ${actualPath}`,
          {
            title: t('common.success'),
            kind: 'info',
          }
        );
      } else {
        // 记录正常撤销成功的日志
        addLog(
          `✅ ${t('history.undoSuccessLog')}: ${action.file_name} → ${
            action.original_path
          }`,
          'success'
        );

        await message(t('history.undoSuccess'), {
          title: t('common.success'),
          kind: 'info',
        });
      }
    } catch (error) {
      console.error('Undo failed:', error);

      // 记录撤销失败的日志
      addLog(
        `❌ ${t('history.undoFailedLog')}: ${action.file_name} - ${error}`,
        'error'
      );

      await message(`${t('history.undoFailed')}: ${error}`, {
        title: t('common.error'),
        kind: 'error',
      });
    } finally {
      setUndoingId(null);
    }
  };

  const handleClearHistory = async () => {
    const confirmed = await ask(t('history.confirmClearHistory'), {
      title: t('history.clearHistory'),
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      // addLog(`🗑️ ${t('history.clearingHistory')}`, 'info');

      clearHistory();

      addLog(`✅ ${t('history.historyCleared')}`, 'success');

      await message(t('history.historyCleared'), {
        title: t('common.success'),
        kind: 'info',
      });
    } catch (error) {
      console.error('Failed to clear history:', error);

      addLog(`❌ ${t('history.clearHistoryFailed')}: ${error}`, 'error');

      await message(`${t('history.clearHistoryFailed')}: ${error}`, {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // 获取最新的历史记录
  const historyEntries = getHistoryEntries(100);

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>{t('history.title')}</h1>
        <p>{t('history.description')}</p>
      </div>

      <div className='settings-section'>
        <div className='setting-card'>
          <div className='setting-header'>
            <div className='setting-title'>
              <svg
                width='16'
                height='16'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' />
              </svg>
              {t('history.fileHistory')} ({historyEntries.length})
            </div>
            <button
              className='btn secondary'
              onClick={handleClearHistory}
              disabled={entries.length === 0}
            >
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' />
              </svg>
              {t('history.clearHistory')}
            </button>
          </div>

          {historyEntries.length === 0 ? (
            <div
              className='setting-content'
              style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}
            >
              <svg
                width='48'
                height='48'
                viewBox='0 0 24 24'
                fill='currentColor'
                style={{ margin: '16px auto', opacity: 0.3 }}
              >
                <path d='M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z' />
              </svg>
              <p>{t('history.noHistory')}</p>
              <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                {t('history.noHistoryDescription')}
              </p>
            </div>
          ) : (
            <div className='setting-content'>
              <div className='history-list-table'>
                <div className='history-table-header'>
                  <div className='history-col-file'>
                    {t('history.fileName')}
                  </div>
                  <div className='history-col-category'>
                    {t('history.category')}
                  </div>
                  <div className='history-col-path'>
                    {t('history.originalPath')}
                  </div>
                  <div className='history-col-time'>{t('history.time')}</div>
                  <div className='history-col-actions'>
                    {t('history.actions')}
                  </div>
                </div>
                <div className='history-table-body'>
                  {historyEntries.map((action: FileHistoryEntry) => (
                    <div key={action.id} className='history-table-row'>
                      <div className='history-col-file'>
                        <div className='file-info'>
                          <span className='file-name'>{action.file_name}</span>
                        </div>
                      </div>
                      <div className='history-col-category'>
                        <span className='category-tag'>{action.category}</span>
                      </div>
                      <div className='history-col-path'>
                        <span
                          className='path-text'
                          title={action.original_path}
                        >
                          {action.original_path}
                        </span>
                      </div>
                      <div className='history-col-time'>
                        <span className='time-text'>
                          {formatTime(action.timestamp)}
                        </span>
                      </div>
                      <div className='history-col-actions'>
                        <button
                          className='btn danger small'
                          onClick={() => handleUndo(action)}
                          disabled={undoingId === action.id}
                          title={t('history.undoAction')}
                        >
                          {undoingId === action.id ? (
                            <div className='spinner small'></div>
                          ) : (
                            <>
                              <svg
                                width='14'
                                height='14'
                                viewBox='0 0 24 24'
                                fill='currentColor'
                              >
                                <path d='M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z' />
                              </svg>
                              {t('history.undo')}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryView;
