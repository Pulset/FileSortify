import React from 'react';
import { ViewType } from '../types';

interface SidebarProps {
    currentView: ViewType;
    onViewChange: (view: ViewType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
    const navItems = [
        {
            id: 'dashboard' as ViewType,
            label: '概览',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                </svg>
            )
        },
        {
            id: 'organize' as ViewType,
            label: '文件整理',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
                </svg>
            )
        },
        {
            id: 'rules' as ViewType,
            label: '分类规则',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
            )
        },
        {
            id: 'logs' as ViewType,
            label: '活动日志',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
            )
        },
        {
            id: 'subscription' as ViewType,
            label: '订阅',
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
            )
        }
    ];

    return (
        <div className="sidebar">
            <nav className="nav-menu">
                {navItems.map((item) => (
                    <div
                        key={item.id}
                        className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                        onClick={() => onViewChange(item.id)}
                    >
                        <div className="nav-icon">{item.icon}</div>
                        <span>{item.label}</span>
                    </div>
                ))}
            </nav>
        </div>
    );
};

export default Sidebar;