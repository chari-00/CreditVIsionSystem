// CreditVision — Lender Dashboard
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, CheckCircle, Clock, XCircle,
  Zap, RefreshCw, TrendingUp, ArrowRight, Send,
} from 'lucide-react';
import { getApproved, getLenderStats, sendResultMail } from '../../services/api';
import RiskMeter, { getColor, getLabel } from '../../components/RiskMeter';
import ApplicantModal from '../../components/ApplicantModal';

function MiniScoreBadge({ score }) {
  const c = getColor(score);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px',
      background: `${c}15`,
      border: `1px solid ${c}30`,
      borderRadius: 99,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: c,
        boxShadow: `0 0 8px ${c}`,
      }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: c, letterSpacing: -0.5 }}>{score}</span>
      <span style={{ fontSize: 10, color: c, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
        {getLabel(score)}
      </span>
    </div>
  );
}

export default function LenderDashboard({ onNavigate }) {
  const [approved, setApproved] = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [sentMails, setSentMails] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([getApproved(), getLenderStats()]);
      setApproved(a);
      setStats(s);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const userName = localStorage.getItem('cv_name') || 'Lender';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) return (
    <div className="loading-center"><div className="spinner" /><span>Loading dashboard…</span></div>
  );

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">
            <LayoutDashboard size={22} />
            {greeting}, {userName.split(' ')[0]}.
          </div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('evaluate')}>
            <Zap size={15} /> Evaluate Applicant
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid-4 mb-24">
          {[
            { l: 'Total Scored',  v: stats.total,       c: 'var(--accent)',  i: TrendingUp },
            { l: 'Approved',      v: stats.approved,    c: '#02b946',        i: CheckCircle },
            { l: 'Under Review',  v: stats.under_review, c: '#f5c518',       i: Clock },
            { l: 'Declined',      v: stats.declined,    c: '#ff3b4e',        i: XCircle },
          ].map(s => (
            <div key={s.l} className="stat-card">
              <span className="stat-label">{s.l}</span>
              <span className="stat-value" style={{ color: s.c }}>{s.v}</span>
              <div className="stat-icon"><s.i size={20} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Approved applicants */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} color="#02b946" /> Approved Applications
            <span style={{
              padding: '2px 8px',
              background: 'rgba(2,185,70,0.1)',
              color: '#02b946',
              borderRadius: 99,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}>{approved.length}</span>
          </h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onNavigate('history')}
          >
            View All History <ArrowRight size={13} />
          </button>
        </div>

        {approved.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} className="empty-icon" />
            <p>No approved applications yet. Evaluate your first applicant to get started.</p>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('evaluate')}>
              <Zap size={13} /> Evaluate Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {approved.map(app => (
              <div
                key={app.id}
                onClick={() => setSelected(app)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                  e.currentTarget.style.background = 'var(--accent-3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--bg-input)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, #02b946, #02e85a)`,
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                      {app.full_name || app.applicant_id}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {app.applicant_id}
                    </div>
                  </div>
                  <MiniScoreBadge score={app.risk_score} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { l: 'Loan Amount', v: `₹${Number(app.loan_amount || 0).toLocaleString('en-IN')}` },
                    { l: 'Tenure',      v: `${app.loan_tenure || '—'} months` },
                    { l: 'PD Value',    v: app.pd_value != null ? `${(app.pd_value * 100).toFixed(2)}%` : '—' },
                    { l: 'Approved',    v: new Date(app.approved_at).toLocaleDateString('en-IN') },
                  ].map(item => (
                    <div key={item.l} style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 }}>{item.l}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.v}</div>
                    </div>
                  ))}
                </div>

                {sentMails.has(app.id) ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '6px 14px', fontSize: 13, fontWeight: 600, color: '#02b946', background: 'rgba(2, 185, 70, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                    <CheckCircle size={15} /> Mail Sent
                  </div>
                ) : (
                  <button 
                    className="btn btn-ghost btn-sm w-full"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', justifyContent: 'center' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      sendResultMail(app.id).then(() => {
                        setSentMails(prev => new Set(prev).add(app.id));
                      });
                    }}
                  >
                    <Send size={13} /> Send Result Mail
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <ApplicantModal applicant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
