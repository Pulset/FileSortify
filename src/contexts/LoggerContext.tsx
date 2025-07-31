import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { LogEntry } from '../types';
import { tauriAPI } from '../utils/tauri';

interface LoggerContextType {
    logs: LogEntry[];
    addLog: (message: string, type?: LogEntry['type']) => void;
    clearLogs: () => void;
}

const LoggerContext = createContext<LoggerContextType | undefined>(undefined);

interface LoggerProviderProps {
    children: ReactNode;
}

export const LoggerProvider: React.FC<LoggerProviderProps> = ({ children }) => {
    const [logs, setLogs] = useState<LogEntry[]>([
        {
            id: '1',
            timestamp: new Date().toLocaleTimeString(),
            message: '正在初始化应用...',
            type: 'info'
        }
    ]);

    // 用于生成唯一 ID 的计数器
    const logIdCounter = React.useRef(2);
    // 用于跟踪监听器状态
    const listenerSetup = React.useRef(false);

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
        const newLog: LogEntry = {
            id: `log-${logIdCounter.current++}`,
            timestamp: new Date().toLocaleTimeString(),
            message,
            type
        };

        setLogs(prevLogs => {
            const newLogs = [...prevLogs, newLog];
            // 保持最新100条日志
            return newLogs.slice(-100);
        });
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([{
            id: `log-${logIdCounter.current++}`,
            timestamp: new Date().toLocaleTimeString(),
            message: '日志已清空',
            type: 'info'
        }]);
    }, []);

    // 监听来自后端的日志事件
    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setupLogListener = async () => {
            // 防止在 StrictMode 下重复设置
            if (listenerSetup.current) {
                console.log('Log listener already setup, skipping...');
                return;
            }

            try {
                // 等待 Tauri API 初始化
                const maxRetries = 10;
                let retries = 0;

                while (retries < maxRetries && !tauriAPI.isInitialized()) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    retries++;
                }

                if (tauriAPI.isInitialized()) {
                    const listenerId = Math.random().toString(36).substr(2, 9);
                    console.log(`Setting up log-message listener with ID: ${listenerId}`);
                    unlisten = await tauriAPI.listen<{ message: string, log_type: string, timestamp: string }>('log-message', (event) => {
                        console.log(`[${listenerId}] Received log-message event:`, event.payload);
                        const { message, log_type, timestamp } = event.payload;

                        // 将后端的日志类型映射到前端类型
                        let type: LogEntry['type'] = 'info';
                        switch (log_type) {
                            case 'error':
                                type = 'error';
                                break;
                            case 'warning':
                                type = 'warning';
                                break;
                            case 'success':
                                type = 'success';
                                break;
                            default:
                                type = 'info';
                        }

                        const newLog: LogEntry = {
                            id: `log-${logIdCounter.current++}`,
                            timestamp,
                            message,
                            type
                        };

                        setLogs(prevLogs => {
                            const newLogs = [...prevLogs, newLog];
                            return newLogs.slice(-100);
                        });
                    });
                    listenerSetup.current = true;
                    console.log('Log listener setup complete');
                } else {
                    console.warn('Tauri API not initialized, skipping log listener setup');
                }
            } catch (error) {
                console.warn('Failed to setup log listener:', error);
            }
        };

        setupLogListener();

        return () => {
            if (unlisten) {
                console.log('Cleaning up log listener...');
                unlisten();
            }
            // 注意：不要在这里重置 listenerSetup.current，因为在 StrictMode 下
            // cleanup 函数会被调用，但我们希望保持监听器状态
        };
    }, []);

    return (
        <LoggerContext.Provider value={{ logs, addLog, clearLogs }}>
            {children}
        </LoggerContext.Provider>
    );
};

export const useLogger = () => {
    const context = useContext(LoggerContext);
    if (context === undefined) {
        throw new Error('useLogger must be used within a LoggerProvider');
    }
    return context;
};