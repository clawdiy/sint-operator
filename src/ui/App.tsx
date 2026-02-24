import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Pipelines from './components/Pipelines';
import Brands from './components/Brands';
import Results from './components/Results';
import Assets from './components/Assets';
import Usage from './components/Usage';
import Skills from './components/Skills';
import Settings from './components/Settings';
import Integrations from './components/Integrations';
import Approvals from './components/Approvals';
import ErrorBoundary from './components/ErrorBoundary';
import Onboarding from './components/Onboarding';
import Auth from './components/Auth';
import Landing from './components/Landing';
import { ToastProvider } from './components/Toast';
import { clearAuthToken } from './api';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills' | 'settings' | 'approvals' | 'integrations';

function getPageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  const valid: Page[] = ['dashboard', 'pipelines', 'brands', 'results', 'assets', 'usage', 'skills', 'settings', 'approvals', 'integrations'];
  return valid.includes(hash as Page) ? (hash as Page) : 'dashboard';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [authed, setAuthed] = useState(() => !!localStorage.getItem('sint_auth_token'));
  const [showAuth, setShowAuth] = useState(false);

  React.useEffect(() => {
    const handler = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
  };

  const handleLogout = () => {
    clearAuthToken();
    setAuthed(false);
  };

  if (!authed) {
    if (!showAuth) {
      return <Landing onGetStarted={() => setShowAuth(true)} />;
    }
    return <Auth onAuth={() => setAuthed(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'pipelines': return <Pipelines />;
      case 'brands': return <Brands />;
      case 'results': return <Results />;
      case 'assets': return <Assets />;
      case 'usage': return <Usage />;
      case 'skills': return <Skills />;
      case 'settings': return <Settings />;
      case 'integrations': return <Integrations />;
      case 'approvals': return <Approvals />;
      default: return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Onboarding onComplete={() => setRefreshKey(k => k + 1)} />
        <Layout currentPage={page} onNavigate={navigate} onLogout={handleLogout}>
          <React.Fragment key={refreshKey}>{renderPage()}</React.Fragment>
        </Layout>
      </ErrorBoundary>
    </ToastProvider>
  );
}
