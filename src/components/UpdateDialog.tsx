import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface UpdateStatus {
  available: boolean;
  current_version: string;
  latest_version?: string;
  download_url?: string;
  body?: string;
}

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose }) => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkForUpdates();
      // 禁用页面滚动 - 针对主要的滚动容器
      const viewElements = document.querySelectorAll('.view');
      const mainContent = document.querySelector('.main-content');

      // 保存原始的 overflow 值
      const originalOverflows: { element: Element; overflow: string }[] = [];

      viewElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        originalOverflows.push({
          element: htmlElement,
          overflow: htmlElement.style.overflow || getComputedStyle(htmlElement).overflow
        });
        htmlElement.style.overflow = 'hidden';
      });

      if (mainContent) {
        const htmlElement = mainContent as HTMLElement;
        originalOverflows.push({
          element: htmlElement,
          overflow: htmlElement.style.overflow || getComputedStyle(htmlElement).overflow
        });
        htmlElement.style.overflow = 'hidden';
      }

      // 也禁用 body 滚动作为备用
      document.body.style.overflow = 'hidden';

      // 存储到组件实例中以便清理
      (window as any).__updateDialogOverflows = originalOverflows;
    } else {
      // 恢复页面滚动
      const originalOverflows = (window as any).__updateDialogOverflows;
      if (originalOverflows) {
        originalOverflows.forEach(({ element, overflow }: { element: HTMLElement; overflow: string }) => {
          if (overflow === 'auto' || overflow === 'scroll' || overflow === 'visible') {
            element.style.overflow = overflow;
          } else {
            element.style.overflow = '';
          }
        });
        delete (window as any).__updateDialogOverflows;
      }
      document.body.style.overflow = '';
    }

    // 监听更新进度
    const unlistenProgress = listen<number>('update-progress', (event) => {
      setProgress(event.payload);
    });

    // 监听更新完成
    const unlistenCompleted = listen('update-completed', () => {
      setIsInstalling(false);
      setProgress(100);
    });

    // 监听应用重启
    const unlistenRestart = listen('update-restart', () => {
      // 可以在这里显示重启提示
      console.log('应用即将重启...');
    });

    // 清理函数：确保组件卸载时恢复滚动
    return () => {
      const originalOverflows = (window as any).__updateDialogOverflows;
      if (originalOverflows) {
        originalOverflows.forEach(({ element, overflow }: { element: HTMLElement; overflow: string }) => {
          if (overflow === 'auto' || overflow === 'scroll' || overflow === 'visible') {
            element.style.overflow = overflow;
          } else {
            element.style.overflow = '';
          }
        });
        delete (window as any).__updateDialogOverflows;
      }
      document.body.style.overflow = '';
      unlistenProgress.then(f => f());
      unlistenCompleted.then(f => f());
      unlistenRestart.then(f => f());
    };
  }, [isOpen]);

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const status = await invoke<UpdateStatus>('check_update');
      setUpdateStatus(status);
    } catch (err) {
      setError(err as string);
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    setIsInstalling(true);
    setProgress(0);
    setError(null);

    try {
      await invoke('install_update');
    } catch (err) {
      setError(err as string);
      setIsInstalling(false);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    // 阻止点击弹框内容时关闭弹框
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleWheelEvent = (e: React.WheelEvent) => {
    // 阻止滚轮事件冒泡到背景
    e.stopPropagation();
  };

  return (
    <div
      className="update-dialog-overlay"
      onClick={handleOverlayClick}
      onWheel={handleWheelEvent}
    >
      <div className="update-dialog" onWheel={handleWheelEvent}>
        <div className="update-dialog-header">
          <h2>应用更新</h2>
          <button
            onClick={onClose}
            className="close-btn"
            disabled={isInstalling}
          >
            ✕
          </button>
        </div>

        {isChecking && (
          <div className="loading">
            <div className="spinner"></div>
            <p>正在检查更新...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {updateStatus && !isChecking && (
          <div className="update-content">
            <div className="version-info">
              <p>
                当前版本: <span className="version-current">{updateStatus.current_version}</span>
              </p>
              {updateStatus.latest_version && (
                <p>
                  最新版本: <span className="version-latest">{updateStatus.latest_version}</span>
                </p>
              )}
            </div>

            {updateStatus.available ? (
              <div>
                {updateStatus.body && (
                  <div className="update-notes">
                    <h3>更新内容:</h3>
                    <div className="update-body">
                      <pre>{updateStatus.body}</pre>
                    </div>
                  </div>
                )}

                {isInstalling ? (
                  <div className="progress-section">
                    <div className="progress-header">
                      <span>下载进度</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    {progress === 100 && (
                      <p className="progress-complete">更新完成，应用将在2秒后自动重启</p>
                    )}
                  </div>
                ) : (
                  <div className="action-buttons">
                    <button
                      onClick={installUpdate}
                      className="btn primary-btn"
                    >
                      立即更新
                    </button>
                    <button
                      onClick={onClose}
                      className="btn secondary-btn"
                    >
                      稍后更新
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-update">
                <div className="success-icon">✓</div>
                <p>已是最新版本</p>
                <button
                  onClick={onClose}
                  className="btn secondary-btn"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};