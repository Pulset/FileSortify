import React, { useState, useEffect } from 'react';
import { SubscriptionStatus } from '../types';
import { tauriAPI } from '../utils/tauri';
import { useLoggerStore } from '../stores';
import { useI18n } from '../contexts/I18nContext';
import CreemSubscriptionView from './CreemSubscriptionView';

const SubscriptionView: React.FC = () => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const { addLog } = useLoggerStore();
  const { t } = useI18n();

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    setLoading(true);
    try {
      if (tauriAPI.isInitialized()) {
        const status = await tauriAPI.getSubscriptionStatus();
        console.log({ status })
        setSubscription(status);
      }
    } catch (error: any) {
      addLog(`❌ ${t('messages.loadingSubscriptionFailed')}: ${error?.message}`, 'error');
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
          <div className='subscription-status'>🎁 {t('subscription.trialStatus')}</div>
          <div className='subscription-details'>
            {t('subscription.trialRemaining', { days: daysRemaining })}
          </div>
          {daysRemaining <= 1 && (
            <div className='trial-warning mt-2'>
              ⚠️ {t('subscription.trialWarning')}
            </div>
          )}
        </div>
      );
    }

    if (subscription.status === 'Active') {
      return (
        <div className='subscription-card active mb-6'>
          <div className='subscription-status'>✨ {t('subscription.activeStatus')}</div>
          <div className='subscription-details'>
            {t('subscription.thankYouMessage')}
          </div>
        </div>
      );
    }

    // Expired or Cancelled
    return (
      <>
        <div className='subscription-card expired mb-6'>
          <div className='subscription-status'>❌ {t('subscription.expiredStatus')}</div>
          <div className='subscription-details'>{t('subscription.expiredWarning')}</div>
        </div>
        <CreemSubscriptionView onPaymentSuccess={loadSubscriptionStatus} />
      </>

    );
  };

  if (loading) {
    return (
      <div className='view active'>
        <div className='loading'>
          <div className='spinner'></div>
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div className='view active'>
      <div className='view-header'>
        <h1>{t('subscription.title')}</h1>
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