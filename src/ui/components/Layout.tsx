import React from 'react';
import NotificationBell from './NotificationBell';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills' | 'settings';

const NAV_ITEMS: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { page: 'pipelines', icon: '⚡', label: 'Pipelines' },
  { page: 'brands', icon: '🎨', label: 'Brands' },
  { page: 'results', icon: '📊', label: 'Results' },
  { page: 'assets', icon: '📁', label: 'Assets' },
  { page: 'usage', icon: '📈', label: 'Usage' },
  { page: 'skills', icon: '🧩', label: 'Skills' },
  { page: 'settings', icon: '⚙️', label: 'Settings' },
];

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, children }: Props) {
  const [collapsed, setCollapsed] = React.useState(() => {
    // Collapsed by default on mobile, expanded on desktop
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  return (
    <div className="layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" onClick={() => setCollapsed(!collapsed)}>
          <span className="logo">🎯</span>
          {!collapsed && <span className="logo-text">SINT</span>}
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.page}
              className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
              onClick={() => onNavigate(item.page)}
              title={item.label}
              data-tooltip={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && <span className="version">v0.5.0</span>}
        </div>
      </aside>
      <div className="main-area">
          <header className="top-bar">
            <div />
            <NotificationBell />
          </header>
          <main className="content">
            {children}
          </main>
        </div>
    </div>
  );
}
