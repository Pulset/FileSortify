import React, { useState } from 'react';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { Config, RulesTabType } from '../types';
import { useConfigStore, useLoggerStore } from '../stores';
import { useI18n } from '../contexts/I18nContext';

interface RulesViewProps {
  config: Config;
  loading: boolean;
}

const RulesView: React.FC<RulesViewProps> = ({ config, loading }) => {
  const [activeTab, setActiveTab] = useState<RulesTabType>('view-rules');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryExtensions, setNewCategoryExtensions] = useState('');
  const { t } = useI18n();

  const {
    addCategory,
    deleteCategory,
    addExtension,
    removeExtension,
    resetConfig,
    exportConfig,
    importConfig,
  } = useConfigStore();

  const { addLog } = useLoggerStore();

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      await message(t('errors.categoryNameRequired'), {
        title: t('common.error'),
        kind: 'warning',
      });
      return;
    }

    try {
      const extensions = newCategoryExtensions
        ? newCategoryExtensions.split(',').map((ext) => ext.trim())
        : [];

      await addCategory(newCategoryName.trim(), extensions);
      addLog(
        `✅ ${t('messages.categoryAdded', { name: newCategoryName.trim(), count: extensions.length })}`
      );
      setNewCategoryName('');
      setNewCategoryExtensions('');
    } catch (error) {
      addLog(`❌ ${t('errors.addCategoryFailed')}: ${error?.message}`, 'error');
      await message(error instanceof Error ? error.message : t('errors.addCategoryFailed'), {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    const confirmed = await ask(t('alerts.deleteCategoryConfirm', { category: categoryName }), {
      title: t('common.confirm'),
      kind: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteCategory(categoryName);
      addLog(`✅ ${t('messages.categoryDeleted', { name: categoryName })}`);
    } catch (error) {
      addLog(`❌ ${t('errors.deleteCategoryFailed')}: ${error?.message}`, 'error');
      await message(error instanceof Error ? error.message : t('errors.deleteCategoryFailed'), {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const handleAddExtension = async (categoryName: string, inputId: string) => {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const extension = input?.value.trim();

    if (!extension) {
      await message(t('errors.extensionRequired'), {
        title: t('common.error'),
        kind: 'warning',
      });
      return;
    }

    try {
      await addExtension(categoryName, extension);
      if (input) input.value = '';
    } catch (error) {
      await message(error instanceof Error ? error.message : t('errors.addExtensionFailed'), {
        title: t('common.error'),
        kind: 'error',
      });
    }
  };

  const handleRemoveExtension = async (
    categoryName: string,
    extension: string
  ) => {
    try {
      await removeExtension(categoryName, extension);
    } catch (error) {
      await message('删除扩展名失败', {
        title: '错误',
        kind: 'error',
      });
    }
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        await importConfig(file);
      } catch (error) {
        await message('导入配置失败', {
          title: '错误',
          kind: 'error',
        });
      }
    };

    input.click();
  };

  const handleResetConfig = async () => {
    const confirmed = await ask(
      '确定要重置为默认配置吗？这将删除所有自定义分类规则。',
      {
        title: '确认重置',
        kind: 'warning',
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      await resetConfig();
    } catch (error) {
      await message('重置配置失败', {
        title: '错误',
        kind: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className='view active'>
        <div className='loading'>
          <div className='spinner'></div>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>分类规则</h1>
        <p>管理文件分类规则和自定义配置</p>
      </div>

      <div className='tab-bar'>
        <button
          className={`tab-btn ${activeTab === 'view-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('view-rules')}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
            <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
          </svg>
          查看规则
        </button>
        <button
          className={`tab-btn ${activeTab === 'manage-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage-rules')}
        >
          <svg width='16' height='16' viewBox='0 0 24 24' fill='currentColor'>
            <path d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' />
          </svg>
          管理规则
        </button>
      </div>

      {/* 查看规则标签页 */}
      {activeTab === 'view-rules' && (
        <div className='tab-panel active'>
          <div className='rules-grid'>
            {Object.entries(config.categories).map(([category, extensions]) => {
              if (extensions.length === 0) return null;
              return (
                <div key={category} className='rule-card'>
                  <div className='rule-card-header'>{category}</div>
                  <div className='rule-extensions'>{extensions.join(', ')}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 管理规则标签页 */}
      {activeTab === 'manage-rules' && (
        <div className='tab-panel active'>
          <div className='rule-manager'>
            <div className='add-rule-section'>
              <div className='section-title'>添加新分类</div>
              <div className='add-rule-form'>
                <div className='form-row'>
                  <input
                    type='text'
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder='分类名称'
                    className='form-input'
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                  <input
                    type='text'
                    value={newCategoryExtensions}
                    onChange={(e) => setNewCategoryExtensions(e.target.value)}
                    placeholder='扩展名 (如: .mp4,.avi,.mov)'
                    className='form-input'
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <button className='add-btn btn' onClick={handleAddCategory}>
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='currentColor'
                  >
                    <path d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' />
                  </svg>
                  添加分类
                </button>
              </div>
            </div>

            <div className='existing-rules-section'>
              <div className='section-title'>现有分类</div>
              <div className='rules-list'>
                {Object.entries(config.categories).map(
                  ([category, extensions]) => {
                    if (category === '其他') return null;
                    return (
                      <div key={category} className='rule-item'>
                        <div className='rule-item-header'>
                          <h4>{category}</h4>
                          <button
                            className='delete-category-btn'
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <svg
                              width='14'
                              height='14'
                              viewBox='0 0 24 24'
                              fill='currentColor'
                            >
                              <path d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' />
                            </svg>
                            删除分类
                          </button>
                        </div>
                        <div className='extensions-list'>
                          {extensions.map((ext) => (
                            <span key={ext} className='extension-tag'>
                              {ext}
                              <button
                                className='remove-ext-btn'
                                onClick={() =>
                                  handleRemoveExtension(category, ext)
                                }
                              >
                                <svg
                                  width='12'
                                  height='12'
                                  viewBox='0 0 24 24'
                                  fill='currentColor'
                                >
                                  <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className='add-extension-form'>
                          <input
                            type='text'
                            placeholder='添加扩展名 (如: .mp4)'
                            id={`ext-input-${category}`}
                            className='extension-input form-input'
                            onKeyPress={(e) =>
                              e.key === 'Enter' &&
                              handleAddExtension(
                                category,
                                `ext-input-${category}`
                              )
                            }
                          />
                          <button
                            className='add-extension-btn btn'
                            onClick={() =>
                              handleAddExtension(
                                category,
                                `ext-input-${category}`
                              )
                            }
                          >
                            <svg
                              width='14'
                              height='14'
                              viewBox='0 0 24 24'
                              fill='currentColor'
                            >
                              <path d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' />
                            </svg>
                            添加
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* <div className='config-actions-section'>
              <div className='section-title'>配置操作</div>
              <div className='config-actions'>
                <button
                  className='config-action-btn export btn secondary'
                  onClick={exportConfig}
                >
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='currentColor'
                  >
                    <path d='M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z' />
                  </svg>
                  导出配置
                </button>
                <button
                  className='config-action-btn import btn secondary'
                  onClick={handleImportConfig}
                >
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='currentColor'
                  >
                    <path d='M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z' />
                  </svg>
                  导入配置
                </button>
                <button
                  className='config-action-btn reset btn danger'
                  onClick={handleResetConfig}
                >
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='currentColor'
                  >
                    <path d='M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z' />
                  </svg>
                  重置默认
                </button>
              </div>
            </div> */}
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesView;
