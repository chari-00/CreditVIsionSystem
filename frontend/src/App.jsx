// CreditVision — App Root
import { useState, useEffect } from 'react';
import './index.css';

import { isAuth, getRole } from './services/api';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';

// Admin pages
import AdminDashboard  from './pages/admin/AdminDashboard';
import DataMonitoring  from './pages/admin/DataMonitoring';
import ActivityLog     from './pages/admin/ActivityLog';
import UserManagement  from './pages/admin/UserManagement';

// Lender pages
import LenderDashboard    from './pages/lender/LenderDashboard';
import EvaluateApplicant  from './pages/lender/EvaluateApplicant';
import LenderHistory      from './pages/lender/LenderHistory';

const ADMIN_PAGES = {
  dashboard: AdminDashboard,
  monitor:   DataMonitoring,
  activity:  ActivityLog,
  users:     UserManagement,
};

const LENDER_PAGES = {
  dashboard: LenderDashboard,
  evaluate:  EvaluateApplicant,
  history:   LenderHistory,
};

export default function App() {
  const [auth,    setAuth]    = useState(isAuth());
  const [role,    setRole]    = useState(getRole() || '');
  const [page,    setPage]    = useState('dashboard');

  // Theme init
  useEffect(() => {
    const saved = localStorage.getItem('cv_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const handleLogin = (r) => {
    setAuth(true);
    setRole(r);
    setPage('dashboard');
  };

  const handleNavigate = (p) => setPage(p);

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  const userName = localStorage.getItem('cv_name') || 'User';
  const pages    = role === 'admin' ? ADMIN_PAGES : LENDER_PAGES;
  const PageComp = pages[page] || pages.dashboard;

  return (
    <div className="app-shell">
      <Sidebar
        role={role}
        activePage={page}
        onNavigate={handleNavigate}
        userName={userName}
      />
      <main className="main-content">
        <PageComp onNavigate={handleNavigate} />
      </main>
    </div>
  );
}
