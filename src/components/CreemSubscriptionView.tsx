import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSubscriptionStore } from '../stores';

interface UserPackage {
  id: string;
  userId: string;
  packageId: string;
  checkoutId: string | null;
  status: string;
  amount: number;
  currency: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  package: PackageInfo;
}

interface CreemPaymentStatus {
  userPackages: UserPackage[];
}

interface PackageInfo {
  name: string;
  description: string;
  price: number; // Price in cents
  currency: string;
  productId: string;
}

interface CreemSubscriptionViewProps {
  onPaymentSuccess?: () => void;
}

const CreemSubscriptionView: React.FC<CreemSubscriptionViewProps> = ({
  onPaymentSuccess,
}) => {
  const [paymentStatus, setPaymentStatus] = useState<CreemPaymentStatus | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  const [pollTimeout, setPollTimeout] = useState<number | null>(null);
  const {
    packages,
    getPackages,
    currentSession,
    getCurrentSession,
    setCurrentSession,
  } = useSubscriptionStore();

  useEffect(() => {
    getCurrentSession();
    getPackages();

    // Cleanup timers when component unmounts
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (pollTimeout) {
        clearTimeout(pollTimeout);
      }
    };
  }, [pollInterval, pollTimeout]);

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      const sessionId = await invoke<string>('open_creem_payment_page', {
        plan: 'lifetime',
      });
      setCurrentSession(sessionId);
      startPolling();
    } catch (error) {
      console.error('Failed to start purchase:', error);
      alert(`购买失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = () => {
    if (isPolling) return;

    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const status = await invoke<CreemPaymentStatus>(
          'check_creem_payment_status'
        );
        setPaymentStatus(status);

        // 只要有userPackages返回就表示已经购买了
        if (status.userPackages.length > 0) {
          const userPackage = status.userPackages[0];

          // 如果是已支付状态，或者其他终止状态，停止轮询
          if (
            userPackage.status === 'PAID' ||
            userPackage.status === 'CANCELLED' ||
            userPackage.status === 'EXPIRED'
          ) {
            clearInterval(interval);
            setPollInterval(null);
            setIsPolling(false);

            if (userPackage.status === 'PAID') {
              // 支付成功后调用父组件的回调函数来刷新订阅状态
              onPaymentSuccess?.();
            }
          }
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
        clearInterval(interval);
        setPollInterval(null);
        setIsPolling(false);
      }
    }, 3000);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPollInterval(null);
      setPollTimeout(null);
      setIsPolling(false);
    }, 30 * 60 * 1000);

    setPollInterval(interval);
    setPollTimeout(timeout);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PAID':
        return '支付成功';
      case 'CANCELLED':
        return '支付失败';
      case 'EXPIRED':
        return '会话过期';
      case 'PENDING':
        return '等待支付';
      default:
        return '未知状态';
    }
  };

  if (!packages) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='flex items-center space-x-3'>
          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
          <span className='text-gray-600'>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full p-6'>
      {/* 支付状态 */}
      {currentSession &&
        paymentStatus &&
        paymentStatus.userPackages.length > 0 && (
          <div className='w-full flex justify-center mb-6'>
            <div className='w-full max-w-md p-4 bg-blue-50 rounded-lg border border-blue-200'>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-sm font-medium text-gray-700'>
                  支付状态
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    paymentStatus.userPackages[0].status === 'PAID'
                      ? 'bg-green-100 text-green-800'
                      : paymentStatus.userPackages[0].status === 'CANCELLED'
                      ? 'bg-red-100 text-red-800'
                      : paymentStatus.userPackages[0].status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {getStatusText(paymentStatus.userPackages[0].status)}
                </span>
              </div>

              {paymentStatus.userPackages[0].status === 'PAID' && (
                <div className='text-sm text-green-700'>
                  ✅ 支付成功！金额: $
                  {(paymentStatus.userPackages[0].amount / 100).toFixed(2)}
                </div>
              )}

              {isPolling && (
                <div className='flex items-center text-blue-600 text-sm mt-2'>
                  <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2'></div>
                  检查支付状态中...
                </div>
              )}
            </div>
          </div>
        )}

      {/* 购买卡片 */}
      <div className='w-full flex justify-center'>
        <div
          className='w-full max-w-md bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden'
          style={{ padding: 20 }}
        >
          <div className='p-5'>
            <h2 className='text-2xl font-semibold text-gray-900 text-center'>
              FileSortify 买断版
            </h2>
            <p className='mt-2 text-sm text-gray-500 text-center'>
              一次购买，永久使用
            </p>

            <div className='mt-6 text-center'>
              <div className='text-5xl font-semibold tracking-tight text-gray-900'>
                {`$${(packages.price / 100).toFixed(2)}`}
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={isLoading || isPolling}
              className='mt-8 w-full h-11 rounded-xl bg-gray-900 text-white font-medium hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
            >
              {isLoading ? (
                <div className='flex items-center justify-center'>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  处理中...
                </div>
              ) : (
                '立即购买'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreemSubscriptionView;
