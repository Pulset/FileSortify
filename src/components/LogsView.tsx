import React, { useEffect, useRef } from 'react';
import { useLogger } from '../contexts/LoggerContext';

const LogsView: React.FC = () => {
  const { logs, clearLogs } = useLogger();
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const getLogTypeClass = (type?: string) => {
    switch (type) {
      case 'success':
        return 'log-success';
      case 'error':
        return 'log-error';
      case 'warning':
        return 'log-warning';
      default:
        return 'log-info';
    }
  };

  return (
    <div className="view active">
      <div className="view-header">
        <h1>活动日志</h1>
        <p>查看文件整理的详细记录</p>
      </div>

      <div className="logs-section">
        <div className="logs-header">
          <div className="logs-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            实时日志
          </div>
          <button className="clear-logs-btn btn secondary" onClick={clearLogs}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            清空日志
          </button>
        </div>
        <div className="logs-terminal">
          {logs.map((log) => (
            <div key={log.id} className={`log-entry ${getLogTypeClass(log.type)}`}>
              <span className="log-time">[{log.timestamp}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default LogsView;