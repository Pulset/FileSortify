import React, { useState, useEffect } from 'react';
import { SubscriptionStatus } from '../types';
import { tauriAPI } from '../utils/tauri';
import { useLogger } from '../contexts/LoggerContext';

const SubscriptionView: React.FC = () => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { addLog } = useLogger();

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
    } catch (error) {
      addLog(`❌ 加载订阅状态失败: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    try {
      const products = await tauriAPI.getAppleProducts();
      const productId = plan === 'monthly' ? products.monthly.product_id : products.yearly.product_id;

      addLog(`🛒 启动Apple订阅购买: ${productId}`, 'info');

      const result = await tauriAPI.startApplePurchase(productId);
      addLog(`✅ ${result}`, 'success');

      // 这里可以显示购买等待对话框
      alert(`正在处理${plan === 'monthly' ? '月度' : '年度'}订阅购买，请在App Store对话框中完成购买。`);
    } catch (error) {
      addLog(`❌ 启动订阅失败: ${error}`, 'error');
      alert(`启动订阅失败: ${error}`);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      addLog('🔄 恢复Apple购买...', 'info');
      const result = await tauriAPI.restoreApplePurchases();
      addLog(`✅ ${result}`, 'success');

      // 重新加载订阅状态
      setTimeout(() => {
        loadSubscriptionStatus();
      }, 3000);
    } catch (error) {
      addLog(`❌ 恢复购买失败: ${error}`, 'error');
      alert(`恢复购买失败: ${error}`);
    }
  };

  const renderSubscriptionContent = () => {
    if (!subscription) {
      return <div className="loading"><div className="spinner"></div>加载订阅信息失败</div>;
    }

    if (subscription.status === 'Trial') {
      const daysRemaining = subscription.trial_start_date
        ? Math.max(0, Math.floor((new Date(subscription.trial_start_date).getTime() + 3 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0;

      return (
        <>
          <div className="subscription-card trial">
            <div className="subscription-status">🎁 试用期</div>
            <div className="subscription-details">剩余 {daysRemaining} 天试用时间</div>
          </div>

          {daysRemaining <= 1 && (
            <div className="trial-warning">
              ⚠️ 试用期即将结束，请及时订阅以继续使用所有功能
            </div>
          )}

          {renderPricingPlans()}
        </>
      );
    }

    if (subscription.status === 'Active') {
      const daysRemaining = subscription.subscription_end_date
        ? Math.max(0, Math.floor((new Date(subscription.subscription_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        : 0;

      return (
        <div className="subscription-card active">
          <div className="subscription-status">✨ 订阅激活</div>
          <div className="subscription-details">
            {subscription.plan === 'Monthly' ? '月度' : '年度'}订阅 · 剩余 {daysRemaining} 天
          </div>
          <button className="btn danger" onClick={handleCancelSubscription}>
            取消订阅
          </button>
        </div>
      );
    }

    // Expired or Cancelled
    return (
      <>
        <div className="subscription-card expired">
          <div className="subscription-status">❌ 订阅已过期</div>
          <div className="subscription-details">请重新订阅以继续使用</div>
        </div>
        <div className="expired-warning">
          订阅已过期，部分功能将无法使用。请重新订阅以恢复完整功能。
        </div>
        {renderPricingPlans()}
      </>
    );
  };

  const renderPricingPlans = () => (
    <div className="pricing-plans">
      <div className="pricing-card">
        <div className="plan-name">月度订阅</div>
        <div className="plan-price">$1.99</div>
        <div className="plan-period">每月</div>
        <ul className="plan-features">
          <li>无限制文件整理</li>
          <li>实时文件监控</li>
          <li>自定义分类规则</li>
          <li>技术支持</li>
        </ul>
        <button className="subscribe-btn btn" onClick={() => handleSubscribe('monthly')}>
          通过App Store订阅
        </button>
      </div>

      <div className="pricing-card recommended">
        <div className="plan-name">年度订阅</div>
        <div className="plan-price">$19.99</div>
        <div className="plan-period">每年 (节省 $4.89)</div>
        <ul className="plan-features">
          <li>无限制文件整理</li>
          <li>实时文件监控</li>
          <li>自定义分类规则</li>
          <li>优先技术支持</li>
          <li>未来功能抢先体验</li>
        </ul>
        <button className="subscribe-btn btn" onClick={() => handleSubscribe('yearly')}>
          通过App Store订阅
        </button>
      </div>
    </div>
  );

  const handleCancelSubscription = async () => {
    if (!confirm('确定要取消订阅吗？取消后将在当前订阅期结束后停止服务。')) {
      return;
    }

    try {
      const result = await tauriAPI.cancelSubscription();
      addLog(`✅ ${result}`, 'success');
      await loadSubscriptionStatus();
    } catch (error) {
      addLog(`❌ 取消订阅失败: ${error}`, 'error');
      alert(`取消订阅失败: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="view active">
        <div className="loading">
          <div className="spinner"></div>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="view active">
      <div className="view-header">
        <h1>订阅</h1>
        <p>管理您的订阅状态和计划</p>
      </div>

      <div className="subscription-section">
        {renderSubscriptionContent()}

        <div className="restore-purchases">
          <button className="btn secondary" onClick={handleRestorePurchases}>
            恢复购买
          </button>
          <p className="restore-hint">
            如果您之前已经购买过，点击此按钮恢复您的订阅
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;