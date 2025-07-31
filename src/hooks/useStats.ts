import { useState } from 'react';
import { Stats } from '../types';

export const useStats = () => {
    const [stats, setStats] = useState<Stats>({
        filesOrganized: 0,
        lastOrganized: null,
        monitoringSince: null
    });

    const updateFilesOrganized = (count: number) => {
        setStats(prev => ({
            ...prev,
            filesOrganized: prev.filesOrganized + count,
            lastOrganized: new Date().toLocaleString()
        }));
    };

    const setMonitoring = (isMonitoring: boolean) => {
        setStats(prev => ({
            ...prev,
            monitoringSince: isMonitoring ? new Date().toLocaleString() : null
        }));
    };

    return {
        stats,
        updateFilesOrganized,
        setMonitoring
    };
};