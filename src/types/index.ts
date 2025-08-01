export interface FileCategory {
  [categoryName: string]: string[];
}

// 单个路径的配置和状态
export interface PathConfig {
  id: string;
  path: string;
  name: string; // 用户自定义的路径名称
  isMonitoring: boolean;
  autoOrganize: boolean;
  // 该路径的统计数据
  stats: {
    filesOrganized: number;
    lastOrganized: string | null;
    monitoringSince: string | null;
  };
  // 可选的路径特定设置
  customCategories?: FileCategory; // 路径特定的分类规则
  excludePatterns?: string[]; // 排除的文件模式
}

export interface Config {
  categories: FileCategory; // 全局分类规则
  // 保持向后兼容性
  downloads_folder?: string;
  auto_organize?: boolean;
  notification_enabled?: boolean;
  rules?: any[];
  // 新的多路径配置
  paths?: PathConfig[];
}

// 全局统计数据
export interface Stats {
  filesOrganized: number;
  lastOrganized: string | null;
  monitoringSince: string | null;
  // 按路径分组的统计
  pathStats?: { [pathId: string]: PathConfig['stats'] };
}

export interface SubscriptionStatus {
  status: 'Trial' | 'Active' | 'Expired' | 'Cancelled';
  trial_start_date?: string;
  subscription_end_date?: string;
  plan?: 'Monthly' | 'Yearly';
  is_subscribed: boolean;
  subscription_type: string;
  expires_at: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
}

export type ViewType =
  | 'dashboard'
  | 'organize'
  | 'rules'
  | 'logs'
  | 'subscription';
export type RulesTabType = 'view-rules' | 'manage-rules'; // Tauri window type declarations for Tauri 2.x
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}
