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

    return () => {
      unlistenProgress.then(f => f());
      unlistenCompleted.then(f => f());
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">应用更新</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            disabled={isInstalling}
          >
            ✕
          </button>
        </div>

        {isChecking && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">正在检查更新...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {updateStatus && !isChecking && (
          <div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                当前版本: <span className="font-medium">{updateStatus.current_version}</span>
              </p>
              {updateStatus.latest_version && (
                <p className="text-sm text-gray-600">
                  最新版本: <span className="font-medium text-green-600">{updateStatus.latest_version}</span>
                </p>
              )}
            </div>

            {updateStatus.available ? (
              <div>
                {updateStatus.body && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">更新内容:</h3>
                    <div className="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap">{updateStatus.body}</pre>
                    </div>
                  </div>
                )}

                {isInstalling ? (
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">下载进度</span>
                      <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    {progress === 100 && (
                      <p className="text-green-600 text-sm mt-2">更新完成，应用将重启</p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={installUpdate}
                      className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                    >
                      立即更新
                    </button>
                    <button
                      onClick={onClose}
                      className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
                    >
                      稍后更新
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="text-green-600 mb-2">✓</div>
                <p className="text-gray-600">已是最新版本</p>
                <button
                  onClick={onClose}
                  className="mt-3 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
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