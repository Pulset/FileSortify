import React from 'react';

interface OrganizeViewProps {
  folderPath: string;
  onFolderPathChange: (path: string) => void;
  onSelectFolder: () => void;
  onOrganizeFiles: () => void;
  onToggleMonitoring: () => void;
  isMonitoring: boolean;
}

const OrganizeView: React.FC<OrganizeViewProps> = ({
  folderPath,
  onFolderPathChange,
  onSelectFolder,
  onOrganizeFiles,
  onToggleMonitoring,
  isMonitoring
}) => {
  return (
    <div className="view active">
      <div className="view-header">
        <h1>文件整理</h1>
        <p>配置文件夹路径和整理选项</p>
      </div>

      <div className="settings-section">
        <div className="setting-card">
          <div className="setting-header">
            <div className="setting-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <div className="setting-title">文件夹路径</div>
          </div>
          <div className="setting-content">
            <div className="input-group">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => onFolderPathChange(e.target.value)}
                className="path-input form-input"
                placeholder="请选择要整理的文件夹"
              />
              <button className="select-btn btn secondary" onClick={onSelectFolder}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                </svg>
                选择文件夹
              </button>
            </div>
            <div className="setting-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              未匹配的文件将保持在原地，不会被移动
            </div>
          </div>
        </div>
      </div>

      <div className="action-section">
        <button className="primary-action-btn btn" onClick={onOrganizeFiles}>
          <div className="btn-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
            </svg>
          </div>
          <span>开始整理文件</span>
        </button>

        <button className="secondary-action-btn btn secondary" onClick={onToggleMonitoring}>
          <div className="btn-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>
          <span>{isMonitoring ? '停止监控' : '开始监控'}</span>
        </button>
      </div>
    </div>
  );
};

export default OrganizeView;