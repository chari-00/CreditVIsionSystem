// CreditVision — Sidebar Navigation
import { useState } from 'react';
import {
  LayoutDashboard, Users, Activity, Database, FileText,
  LogOut, Zap, ChevronRight, Settings,
  BarChart3, PlusCircle, Clock,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { logout } from '../services/api';

const adminNav = [
  { key: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
  { key: 'monitor',   label: 'Data Monitoring',  icon: Database },
  { key: 'activity',  label: 'Activity Log',     icon: Activity },
  { key: 'users',     label: 'User Management',  icon: Users },
];

const lenderNav = [
  { key: 'dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { key: 'evaluate',   label: 'Evaluate Applicant', icon: PlusCircle },
  { key: 'history',    label: 'History',         icon: Clock },
];

export default function Sidebar({ role, activePage, onNavigate, userName }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const nav = role === 'admin' ? adminNav : lenderNav;

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = '/';
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" style={{ 
          overflow: 'hidden', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img src="/CV_Logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div>
          <div className="sidebar-logo-text">CreditVision</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {nav.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={`nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <Icon size={16} className="nav-icon" />
              {item.label}
              {activePage === item.key && (
                <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <ThemeToggle />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 12px 8px',
          marginTop: 8,
        }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--accent)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }}>
            {(userName || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>{role}</div>
          </div>
        </div>
        <button
          className="nav-item btn-danger"
          onClick={handleLogout}
          disabled={loggingOut}
          style={{ marginTop: 4, border: '1px solid rgba(255,59,78,0.15)' }}
        >
          <LogOut size={14} />
          {loggingOut ? 'Logging out…' : 'Sign Out'}
        </button>
      </div>
    </aside>
  );
}
