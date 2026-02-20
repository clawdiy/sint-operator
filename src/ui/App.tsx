import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Pipelines from './components/Pipelines';
import Brands from './components/Brands';
import Results from './components/Results';
import Assets from './components/Assets';
import Usage from './components/Usage';
import Skills from './components/Skills';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';

type Page = 'dashboard' | 'pipelines' | 'brands' | 'results' | 'assets' | 'usage' | 'skills';

function getPageFromHash(): Page {
  const hash = window.location.hash.slice(1);
  const valid: Page[] = ['dashboard', 'pipelines', 'brands', 'results', 'assets', 'usage', 'skills'];
  return valid.includes(hash as Page) ? (hash as Page) : 'dashboard';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPageFromHash);

  React.useEffect(() => {
    const handler = () => setPage(getPageFromHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'pipelines': return <Pipelines />;
      case 'brands': return <Brands />;
      case 'results': return <Results />;
      case 'assets': return <Assets />;
      case 'usage': return <Usage />;
      case 'skills': return <Skills />;
      default: return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <ToastProvider>
      <ErrorBoundary>
        <Layout currentPage={page} onNavigate={navigate}>
          {renderPage()}
        </Layout>
      </ErrorBoundary>
    </ToastProvider>
  );
}
