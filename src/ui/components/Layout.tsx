import React from 'react';
import NotificationBell from './NotificationBell';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills' | 'settings' | 'approvals';

const NAV_ITEMS: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { page: 'pipelines', icon: '⚡', label: 'Pipelines' },
  { page: 'brands', icon: '🎨', label: 'Brands' },
  { page: 'results', icon: '📊', label: 'Results' },
  { page: 'assets', icon: '📁', label: 'Assets' },
  { page: 'usage', icon: '📈', label: 'Usage' },
  { page: 'skills', icon: '🧩', label: 'Skills' },
  { page: 'approvals', icon: '📋', label: 'Approvals' },
  { page: 'settings', icon: '⚙️', label: 'Settings' },
];

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, onLogout, children }: Props) {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('sint_sidebar_collapsed');
    if (stored !== null) return stored === 'true';
    return window.innerWidth < 900;
  });

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sint_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header" onClick={toggleSidebar}>
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
          <button className="sidebar-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '▶' : '◀'}
          </button>
          {!collapsed && <span className="version">v0.5.0</span>}
          {onLogout && (
            <button
              className="nav-item"
              onClick={onLogout}
              title="Log out"
              style={{ marginTop: 8, color: '#f85149' }}
            >
              <span className="nav-icon">🚪</span>
              {!collapsed && <span className="nav-label">Log Out</span>}
            </button>
          )}
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
