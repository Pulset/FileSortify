import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

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

interface SubscriptionState {
    packages: PackageInfo;
    currentSession: string | null;
    getPackages: () => void;
    getCurrentSession: () => void;
    setCurrentSession: (currentSession: string | null) => void
}

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set) => ({
            packages: {} as PackageInfo,
            currentSession: null,
            getPackages: async () => {
                try {
                    const packagesInfo = await invoke<PackagesResponse>('fetch_packages_from_server');
                    set({ packages: packagesInfo.packages });
                } catch (error) {
                    console.error('Failed to load packages from server:', error);
                    // 如果服务端获取失败，回退到本地数据
                    try {
                        const localPackages = await invoke<PackagesResponse>('get_packages');
                        set({ packages: localPackages.packages });
                    } catch (localError) {
                        console.error('Failed to load local packages:', localError);
                    }
                }
            },
            getCurrentSession: async () => {
                try {
                    const sessionId = await invoke<string | null>('get_current_session_info');
                    set({ currentSession: sessionId })
                } catch (error) {
                    console.error('Failed to load current session:', error);
                }
            },
            setCurrentSession: (currentSession) => {
                set({ currentSession })
            }
        }),
        {
            name: 'subscription-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                packages: state.packages,
                currentSession: state.currentSession
            }),
        }
    )
);