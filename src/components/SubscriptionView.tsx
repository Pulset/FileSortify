import React, { useState, useEffect } from 'react';
import { SubscriptionStatus } from '../types';
import { tauriAPI } from '../utils/tauri';
import { useLoggerStore } from '../stores';
import CreemSubscriptionView from './CreemSubscriptionView';

const SubscriptionView: React.FC = () => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const { addLog } = useLoggerStore();

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    setLoading(true);
    try {
      if (tauriAPI.isInitialized()) {
        const status = await tauriAPI.getSubscriptionStatus();
        setSubscription(status);
      }
    } catch (error: any) {
      addLog(`❌ 加载订阅状态失败: ${error?.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderSubscriptionContent = () => {
    if (!subscription) {
      return null;
    }

    if (subscription.status === 'Trial') {
      const daysRemaining = subscription.trial_start_date
        ? Math.max(
          0,
          Math.floor(
            (new Date(subscription.trial_start_date).getTime() +
              3 * 24 * 60 * 60 * 1000 -
              Date.now()) /
            (24 * 60 * 60 * 1000)
          )
        )
        : 0;

      return (
        <div className='subscription-card trial mb-6'>
          <div className='subscription-status'>🎁 试用期</div>
          <div className='subscription-details'>
            剩余 {daysRemaining} 天试用时间
          </div>
          {daysRemaining <= 1 && (
            <div className='trial-warning mt-2'>
              ⚠️ 试用期即将结束，请及时购买以继续使用所有功能
            </div>
          )}
        </div>
      );
    }

    if (subscription.status === 'Active') {
      return (
        <div className='subscription-card active mb-6'>
          <div className='subscription-status'>✨ 已购买</div>
          <div className='subscription-details'>
            感谢您购买 FileSortify！现在可以无限制使用所有功能。
          </div>
        </div>
      );
    }

    // Expired or Cancelled
    return (
      <div className='subscription-card expired mb-6'>
        <div className='subscription-status'>❌ 试用已结束</div>
        <div className='subscription-details'>请购买完整版以继续使用</div>
        <CreemSubscriptionView />
      </div>
    );
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
        <h1>购买</h1>
        <p>购买 FileSortify 完整版</p>
      </div>

      <div className='subscription-section'>
        {/* 显示当前状态 */}
        {renderSubscriptionContent()}

        {/* 显示购买界面 */}
        {/* <CreemSubscriptionView /> */}
      </div>
    </div>
  );
};

export default SubscriptionView;