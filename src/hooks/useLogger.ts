import { useState, useCallback } from 'react';
import { LogEntry } from '../types';

export const useLogger = () => {
    const [logs, setLogs] = useState<LogEntry[]>([
        {
            id: '1',
            timestamp: new Date().toLocaleTimeString(),
            message: '正在初始化应用...',
            type: 'info'
        }
    ]);

    const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
        const newLog: LogEntry = {
            id: Date.now().toString(),
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
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            message: '日志已清空',
            type: 'info'
        }]);
    }, []);

    return {
        logs,
        addLog,
        clearLogs
    };
};