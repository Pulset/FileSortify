import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Config, SubscriptionStatus } from '../types';

// Check if we're running in Tauri environment
function isTauriEnvironment(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

// Tauri API wrapper with error handling
export class TauriAPI {
  private static instance: TauriAPI;
  private initialized = false;
  private isTauri = false;

  static getInstance(): TauriAPI {
    if (!TauriAPI.instance) {
      TauriAPI.instance = new TauriAPI();
    }
    return TauriAPI.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // First check if we're in a Tauri environment
      this.isTauri = isTauriEnvironment();

      console.log('Tauri environment check:', {
        isTauri: this.isTauri,
        hasWindow: typeof window !== 'undefined',
        hasTauriInternals:
          typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
        hasTauri: typeof window !== 'undefined' && '__TAURI__' in window,
        windowKeys:
          typeof window !== 'undefined'
            ? Object.keys(window).filter((k) => k.includes('TAURI'))
            : [],
      });

      if (!this.isTauri) {
        console.warn(
          'Not running in Tauri environment - some features will be disabled'
        );
        this.initialized = false;
        return false;
      }

      // Test if Tauri is available and working
      console.log('Testing Tauri invoke...');
      await invoke('can_use_app');
      console.log('Tauri invoke successful');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Tauri API initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isTauriApp(): boolean {
    return this.isTauri;
  }

  async invoke<T>(command: string, args?: Record<string, any>): Promise<T> {
    if (!this.initialized) {
      throw new Error(
        "Tauri API not initialized - make sure you're running in the Tauri app"
      );
    }
    return invoke(command, args);
  }

  async listen<T>(event: string, handler: (event: { payload: T }) => void) {
    if (!this.initialized) {
      throw new Error(
        "Tauri API not initialized - make sure you're running in the Tauri app"
      );
    }
    try {
      console.log('Setting up event listener for:', event);
      return await listen(event, handler);
    } catch (error) {
      console.warn(
        'Event listening failed, possibly due to permissions:',
        error
      );
      return () => { }; // 返回一个空的取消函数
    }
  }

  async sendNotification(title: string, body: string) {
    if (!this.initialized) {
      console.warn('Tauri API not initialized, skipping notification');
      return;
    }
    try {
      // 在 Tauri 2.x 中，通知通过后端处理
      // 后端的 main.rs 中已经有通知功能
      console.log('Sending notification:', { title, body });
      // 通知功能已经在后端的 toggle_monitoring 和 organize_files 中实现
    } catch (error) {
      console.warn('Notification failed:', error);
    }
  }

  // Specific API methods with fallbacks for web mode
  async canUseApp(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }
    return this.invoke('can_use_app');
  }

  async canUseAppSecure(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }
    return this.invoke('can_use_app_secure');
  }

  async getConfig(): Promise<Config> {
    if (!this.initialized) {
      // Return default config for web mode
      return {
        categories: {},
        downloads_folder: '',
        auto_organize: false,
        notification_enabled: true,
        rules: [],
      };
    }
    return this.invoke('get_config');
  }

  async saveConfig(config: Config): Promise<void> {
    if (!this.initialized) {
      console.warn('Cannot save config in web mode');
      return;
    }
    return this.invoke('save_config', { config });
  }

  async getDefaultDownloadsFolder(): Promise<string> {
    if (!this.initialized) {
      return '~/Downloads';
    }
    return this.invoke('get_default_downloads_folder');
  }

  async selectFolder(): Promise<string | null> {
    if (!this.initialized) {
      console.warn('Folder selection not available in web mode');
      return null;
    }
    return this.invoke('select_folder');
  }

  async organizeFiles(folderPath: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('File organization not available in web mode');
    }
    return this.invoke('organize_files', { folderPath });
  }

  async toggleMonitoring(folderPath: string): Promise<boolean> {
    if (!this.initialized) {
      console.warn('Monitoring not available in web mode');
      return false;
    }
    console.log('Calling toggle_monitoring with folderPath:', folderPath);
    try {
      const result = await this.invoke('toggle_monitoring', { folderPath });
      console.log('toggle_monitoring result:', result);
      return result as boolean;
    } catch (error) {
      console.error('toggle_monitoring error:', error);
      throw error;
    }
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    if (!this.initialized) {
      return {
        status: 'Expired',
        is_subscribed: false,
        subscription_type: 'none',
        expires_at: null,
      };
    }
    return this.invoke('get_subscription_status');
  }

  async getAppleProducts(): Promise<any> {
    if (!this.initialized) {
      return [];
    }
    return this.invoke('get_apple_products');
  }

  async startApplePurchase(productId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Apple purchases not available in web mode');
    }
    return this.invoke('start_apple_purchase', { product_id: productId });
  }

  async getLocalReceiptData(): Promise<string | null> {
    if (!this.initialized) {
      return null;
    }
    return this.invoke('get_local_receipt_data');
  }

  async verifyAppleReceipt(receiptData: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Receipt verification not available in web mode');
    }
    return this.invoke('verify_apple_receipt', { receipt_data: receiptData });
  }

  async restoreApplePurchases(): Promise<string> {
    if (!this.initialized) {
      throw new Error('Purchase restoration not available in web mode');
    }
    return this.invoke('restore_apple_purchases');
  }

  async cancelSubscription(): Promise<string> {
    if (!this.initialized) {
      throw new Error('Subscription cancellation not available in web mode');
    }
    return this.invoke('cancel_subscription');
  }

  // Creem 订阅相关方法
  async createCreemSession(plan: string): Promise<any> {
    if (!this.initialized) {
      throw new Error('Creem payments not available in web mode');
    }
    return this.invoke('create_creem_session', { plan });
  }

  async checkCreemPaymentStatus(): Promise<any> {
    if (!this.initialized) {
      throw new Error('Creem payment status check not available in web mode');
    }
    return this.invoke('check_creem_payment_status');
  }

  async openCreemPaymentPage(plan: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Creem payment page not available in web mode');
    }
    return this.invoke('open_creem_payment_page', { plan });
  }

  async setWebhookServerUrl(url: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Webhook server URL setting not available in web mode');
    }
    return this.invoke('set_webhook_server_url', { url });
  }

  async getCurrentSessionInfo(): Promise<string | null> {
    if (!this.initialized) {
      return null;
    }
    return this.invoke('get_current_session_info');
  }
}

export const tauriAPI = TauriAPI.getInstance();
