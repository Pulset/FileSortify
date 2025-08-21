import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Config } from '../types';
import { tauriAPI } from '../utils/tauri';
import { DEFAULT_CONFIG } from '../utils/defaultConfig';
import { t } from '../contexts/I18nContext';

interface ConfigState {
  config: Config;
  loading: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (newConfig: Config) => Promise<void>;
  addCategory: (name: string, extensions: string[]) => Promise<void>;
  deleteCategory: (categoryName: string) => Promise<void>;
  addExtension: (categoryName: string, extension: string) => Promise<void>;
  removeExtension: (categoryName: string, extension: string) => Promise<void>;
  resetConfig: () => Promise<void>;
  exportConfig: () => void;
  importConfig: (file: File) => Promise<void>;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      loading: false,

      loadConfig: async () => {
        set({ loading: true });
        try {
          console.log('Loading config...');
          if (tauriAPI.isInitialized()) {
            const loadedConfig = await tauriAPI.getConfig();
            console.log('Config loaded:', loadedConfig);
            if (loadedConfig && loadedConfig.categories) {
              set({ config: loadedConfig });
            } else {
              set({ config: DEFAULT_CONFIG });
            }
          } else {
            console.log('Tauri not initialized, using default config');
            set({ config: DEFAULT_CONFIG });
          }
        } catch (error) {
          console.error(
            'Failed to load config:',
            error instanceof Error ? error.message : error
          );
          set({ config: DEFAULT_CONFIG });
        } finally {
          set({ loading: false });
        }
      },

      saveConfig: async (newConfig: Config) => {
        try {
          if (tauriAPI.isInitialized()) {
            await tauriAPI.saveConfig(newConfig);
          }
          set({ config: newConfig });
        } catch (error) {
          throw error;
        }
      },

      addCategory: async (name: string, extensions: string[]) => {
        const { config, saveConfig } = get();

        if (config.categories[name]) {
          throw new Error(t('errors.categoryNameExists'));
        }

        const normalizedExtensions = extensions
          .map((ext) => {
            ext = ext.trim();
            return ext.startsWith('.') ? ext : `.${ext}`;
          })
          .filter((ext) => ext.length > 1);

        const newConfig = {
          ...config,
          categories: {
            ...config.categories,
            [name]: normalizedExtensions,
          },
        };

        await saveConfig(newConfig);
      },

      deleteCategory: async (categoryName: string) => {
        const { config, saveConfig } = get();
        const newConfig = {
          ...config,
          categories: { ...config.categories },
        };
        delete newConfig.categories[categoryName];

        await saveConfig(newConfig);
      },

      addExtension: async (categoryName: string, extension: string) => {
        const { config, saveConfig } = get();
        const normalizedExt = extension.startsWith('.')
          ? extension
          : `.${extension}`;

        if (!/^\.[\w]+$/.test(normalizedExt)) {
          throw new Error(t('errors.extensionFormatInvalid'));
        }

        if (config.categories[categoryName]?.includes(normalizedExt)) {
          throw new Error(t('errors.extensionExists'));
        }

        const newConfig = {
          ...config,
          categories: {
            ...config.categories,
            [categoryName]: [
              ...(config.categories[categoryName] || []),
              normalizedExt,
            ],
          },
        };

        await saveConfig(newConfig);
      },

      removeExtension: async (categoryName: string, extension: string) => {
        const { config, saveConfig } = get();
        const newConfig = {
          ...config,
          categories: {
            ...config.categories,
            [categoryName]:
              config.categories[categoryName]?.filter(
                (ext) => ext !== extension
              ) || [],
          },
        };

        await saveConfig(newConfig);
      },

      resetConfig: async () => {
        const { saveConfig } = get();
        await saveConfig(DEFAULT_CONFIG);
      },

      exportConfig: () => {
        const { config } = get();
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'file_organizer_config.json';
        link.click();
      },

      importConfig: (file: File) => {
        const { saveConfig } = get();
        return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const text = e.target?.result as string;
              const importedConfig = JSON.parse(text);
              await saveConfig(importedConfig);
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          reader.readAsText(file);
        });
      },
    }),
    {
      name: 'config-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);
