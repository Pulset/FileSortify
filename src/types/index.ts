export interface FileCategory {
    [categoryName: string]: string[];
}

export interface Config {
    categories: FileCategory;
    downloads_folder: string;
    auto_organize: boolean;
    notification_enabled: boolean;
    rules: any[];
}

export interface Stats {
    filesOrganized: number;
    lastOrganized: string | null;
    monitoringSince: string | null;
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

export type ViewType = 'dashboard' | 'organize' | 'rules' | 'logs' | 'subscription';
export type RulesTabType = 'view-rules' | 'manage-rules';// Tauri window type declarations for Tauri 2.x
declare global {
    interface Window {
        __TAURI_INTERNALS__?: any;
    }
}