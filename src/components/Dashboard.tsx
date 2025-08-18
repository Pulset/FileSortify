import React from 'react';
import { Stats } from '../types';
import { useI18n } from '../contexts/I18nContext';

interface DashboardProps {
  stats: Stats;
  isMonitoring: boolean;
  onOrganizeFiles: () => void;
  onToggleMonitoring: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  stats,
  isMonitoring,
  onOrganizeFiles,
  onToggleMonitoring,
}) => {
  const { t } = useI18n();

  // 计算监控路径数量
  const monitoringPathsCount = stats.pathStats
    ? Object.values(stats.pathStats).filter(pathStat => pathStat.monitoringSince !== null).length
    : 0;

  const totalPathsCount = stats.pathStats ? Object.keys(stats.pathStats).length : 0;

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.description')}</p>
      </div>

      <div className='dashboard-grid'>
        <div className='stat-card'>
          <div className='stat-icon files'>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z' />
            </svg>
          </div>
          <div className='stat-content'>
            <div className='stat-number'>{stats.filesOrganized}</div>
            <div className='stat-label'>{t('dashboard.stats.filesOrganized')}</div>
          </div>
        </div>

        <div className='stat-card'>
          <div className='stat-icon time'>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z' />
              <path d='M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z' />
            </svg>
          </div>
          <div className='stat-content'>
            <div className='stat-number'>{stats.lastOrganized || t('dashboard.stats.notStarted')}</div>
            <div className='stat-label'>{t('dashboard.stats.lastOrganized')}</div>
          </div>
        </div>

        <div className='stat-card'>
          <div className='stat-icon monitor'>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z' />
            </svg>
          </div>
          <div className='stat-content'>
            <div className='stat-number'>
              {monitoringPathsCount > 0 ? t('dashboard.stats.monitoring') : t('dashboard.stats.stopped')}
            </div>
            <div className='stat-label'>{t('dashboard.stats.monitoringStatus')}</div>
          </div>
        </div>

        {/* 新增路径统计卡片 */}
        <div className='stat-card'>
          <div className='stat-icon' style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' }}>
            <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M20 6h-2v-.85C18 4.53 17.48 4 16.86 4H15.14C14.52 4 14 4.53 14 5.15V6H10v-.85C10 4.53 9.48 4 8.86 4H7.14C6.52 4 6 4.53 6 5.15V6H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z' />
            </svg>
          </div>
          <div className='stat-content'>
            <div className='stat-number'>{totalPathsCount}</div>
            <div className='stat-label'>{t('organize.folderPath')}</div>
          </div>
        </div>
      </div>

      <div className='quick-actions'>
        <div className='section-title'>{t('dashboard.actions.quickActions')}</div>
        <div className='action-buttons'>
          <button className='action-btn' onClick={onOrganizeFiles}>
            <div className='btn-icon'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z' />
              </svg>
            </div>
            <div className='btn-text'>
              <div className='btn-title'>{t('dashboard.actions.organizeFiles')}</div>
              <div className='btn-desc'>{t('dashboard.actions.organizeFilesDesc')}</div>
            </div>
          </button>

          <button className='action-btn secondary' onClick={onToggleMonitoring}>
            <div className='btn-icon'>
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='currentColor'
              >
                <path d='M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' />
              </svg>
            </div>
            <div className='btn-text'>
              <div className='btn-title'>
                {isMonitoring ? t('dashboard.actions.stopMonitoring') : t('dashboard.actions.startMonitoring')}
              </div>
              <div className='btn-desc'>{t('dashboard.actions.autoMonitorDesc')}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
