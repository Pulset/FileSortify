import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

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
    userPackage: UserPackage;
}

interface PackageInfo {
    name: string;
    description: string;
    price: number; // Price in cents
    currency: string;
    productId: string;
}

interface PackagesResponse {
    packages: PackageInfo;
}

const CreemSubscriptionView: React.FC = () => {
    const [packages, setPackages] = useState<PackageInfo | null>(null);
    const [currentSession, setCurrentSession] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<CreemPaymentStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
    const [pollTimeout, setPollTimeout] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadCurrentSession();
        loadPackagesFromServer();

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



    const loadPackagesFromServer = async () => {
        try {
            const packagesInfo = await invoke<PackagesResponse>('fetch_packages_from_server');
            setPackages(packagesInfo.packages);
        } catch (error) {
            console.error('Failed to load packages from server:', error);
            // 如果服务端获取失败，回退到本地数据
            try {
                const localPackages = await invoke<PackagesResponse>('get_packages');
                setPackages(localPackages.packages);
            } catch (localError) {
                console.error('Failed to load local packages:', localError);
            }
        }
    };

    const loadCurrentSession = async () => {
        try {
            const sessionId = await invoke<string | null>('get_current_session_info');
            setCurrentSession(sessionId);
        } catch (error) {
            console.error('Failed to load current session:', error);
        }
    };

    const handlePurchase = async () => {
        setIsLoading(true);
        try {
            const sessionId = await invoke<string>('open_creem_payment_page', { plan: 'lifetime' });
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
                const status = await invoke<CreemPaymentStatus>('check_creem_payment_status');
                setPaymentStatus(status);

                if (status.userPackage.status === 'PAID' || status.userPackage.status === 'CANCELLED' || status.userPackage.status === 'EXPIRED') {
                    clearInterval(interval);
                    setPollInterval(null);
                    setIsPolling(false);

                    if (status.userPackage.status === 'PAID') {
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
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
            case 'PAID': return '支付成功';
            case 'CANCELLED': return '支付失败';
            case 'EXPIRED': return '会话过期';
            case 'PENDING': return '等待支付';
            default: return '未知状态';
        }
    };

    if (!packages) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="text-gray-600">加载中...</span>
                </div>
            </div>
        );
    }

    console.log({ packages, currentSession })
    return (
        <div className="max-w-md mx-auto p-6">
            {/* 支付状态 */}
            {currentSession && paymentStatus && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">支付状态</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${paymentStatus.userPackage.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            paymentStatus.userPackage.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                paymentStatus.userPackage.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-100 text-gray-800'
                            }`}>
                            {getStatusText(paymentStatus.userPackage.status)}
                        </span>
                    </div>

                    {paymentStatus.userPackage.status === 'PAID' && (
                        <div className="text-sm text-green-700">
                            ✅ 支付成功！金额: ${(paymentStatus.userPackage.amount / 100).toFixed(2)}
                        </div>
                    )}

                    {isPolling && (
                        <div className="flex items-center text-blue-600 text-sm mt-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                            检查支付状态中...
                        </div>
                    )}
                </div>
            )}

            {/* 购买卡片 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                {/* 标题 */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-center">
                    <h2 className="text-xl font-bold text-white">FileSortify 买断版</h2>
                    <p className="text-blue-100 text-sm mt-1">一次购买，永久使用</p>
                </div>

                <div className="p-6">
                    {/* 价格 */}
                    <div className="text-center mb-6">
                        <div className="text-4xl font-bold text-gray-900 mb-2">
                            {`${(packages.price / 100).toFixed(2)}`}
                        </div>
                        <p className="text-gray-600">一次性付费</p>
                    </div>

                    {/* 购买按钮 */}
                    <button
                        onClick={handlePurchase}
                        disabled={isLoading || isPolling}
                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                处理中...
                            </div>
                        ) : (
                            '立即购买'
                        )}
                    </button>

                    {/* 支付方式 */}
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-500 mb-2">支持多种支付方式</p>
                        <div className="flex items-center justify-center space-x-3 text-lg">
                            <span>💳</span>
                            <span>🏦</span>
                            <span>📱</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 购买说明 */}
            <div className="mt-6 bg-gray-50 rounded-xl p-4">
                <h4 className="font-medium text-gray-900 mb-3">购买说明</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 点击购买后跳转到安全支付页面</li>
                    <li>• 支付完成后自动激活完整版功能</li>
                    <li>• 一次购买，终身使用</li>
                    <li>• 如有问题，请联系客服支持</li>
                </ul>
            </div>
        </div>
    );
};

export default CreemSubscriptionView;