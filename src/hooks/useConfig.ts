import { useState } from 'react';
import { Config } from '../types';
import { tauriAPI } from '../utils/tauri';
import { DEFAULT_CONFIG } from '../utils/defaultConfig';
import { useLogger } from '../contexts/LoggerContext';

export const useConfig = () => {
    const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const { addLog } = useLogger();

    const loadConfig = async () => {
        setLoading(true);
        try {
            if (tauriAPI.isInitialized()) {
                const loadedConfig = await tauriAPI.getConfig();
                if (loadedConfig && loadedConfig.categories) {
                    setConfig(loadedConfig);
                    addLog('✅ 配置加载成功');
                } else {
                    setConfig(DEFAULT_CONFIG);
                    addLog('使用默认分类规则');
                }
            } else {
                setConfig(DEFAULT_CONFIG);
                addLog('使用默认分类规则');
            }
        } catch (error) {
            addLog(`❌ 加载配置失败，使用默认配置: ${error}`);
            setConfig(DEFAULT_CONFIG);
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = async (newConfig: Config) => {
        try {
            if (tauriAPI.isInitialized()) {
                await tauriAPI.saveConfig(newConfig);
                addLog('✅ 配置已保存');
            }
            setConfig(newConfig);
        } catch (error) {
            addLog(`❌ 保存配置失败: ${error}`);
            throw error;
        }
    };

    const addCategory = async (name: string, extensions: string[]) => {
        if (config.categories[name]) {
            throw new Error('该分类名称已存在');
        }

        const normalizedExtensions = extensions.map(ext => {
            ext = ext.trim();
            return ext.startsWith('.') ? ext : `.${ext}`;
        }).filter(ext => ext.length > 1);

        const newConfig = {
            ...config,
            categories: {
                ...config.categories,
                [name]: normalizedExtensions
            }
        };

        await saveConfig(newConfig);
        addLog(`✅ 成功添加分类: ${name}，包含 ${normalizedExtensions.length} 个扩展名`);
    };

    const deleteCategory = async (categoryName: string) => {
        const newConfig = {
            ...config,
            categories: { ...config.categories }
        };
        delete newConfig.categories[categoryName];

        await saveConfig(newConfig);
        addLog(`✅ 成功删除分类: ${categoryName}`);
    };

    const addExtension = async (categoryName: string, extension: string) => {
        const normalizedExt = extension.startsWith('.') ? extension : `.${extension}`;

        if (!/^\.[\w]+$/.test(normalizedExt)) {
            throw new Error('请输入有效的扩展名格式 (如: .mp4)');
        }

        if (config.categories[categoryName]?.includes(normalizedExt)) {
            throw new Error('该扩展名已存在');
        }

        const newConfig = {
            ...config,
            categories: {
                ...config.categories,
                [categoryName]: [...(config.categories[categoryName] || []), normalizedExt]
            }
        };

        await saveConfig(newConfig);
        addLog(`✅ 向分类 ${categoryName} 添加扩展名: ${normalizedExt}`);
    };

    const removeExtension = async (categoryName: string, extension: string) => {
        const newConfig = {
            ...config,
            categories: {
                ...config.categories,
                [categoryName]: config.categories[categoryName]?.filter(ext => ext !== extension) || []
            }
        };

        await saveConfig(newConfig);
        addLog(`✅ 从分类 ${categoryName} 移除扩展名: ${extension}`);
    };

    const resetConfig = async () => {
        await saveConfig(DEFAULT_CONFIG);
        addLog('✅ 已重置为默认配置');
    };

    const exportConfig = () => {
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'file_organizer_config.json';
        link.click();
        addLog('✅ 配置已导出');
    };

    const importConfig = (file: File) => {
        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target?.result as string;
                    const importedConfig = JSON.parse(text);
                    await saveConfig(importedConfig);
                    addLog('✅ 成功导入配置');
                    resolve();
                } catch (error) {
                    addLog(`❌ 导入配置失败: ${error}`);
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    };

    // 移除自动加载，由 App.tsx 在 Tauri 初始化后手动调用

    return {
        config,
        loading,
        loadConfig,
        saveConfig,
        addCategory,
        deleteCategory,
        addExtension,
        removeExtension,
        resetConfig,
        exportConfig,
        importConfig
    };
};