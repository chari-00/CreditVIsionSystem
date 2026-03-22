// CreditVision — Lender History
import { useState, useEffect } from 'react';
import {
  Clock, Search, RefreshCw, CheckCircle, AlertTriangle,
  XCircle, ChevronRight, Send,
} from 'lucide-react';
import { getLenderHistory, sendResultMail } from '../../services/api';
import RiskMeter, { getColor, getLabel } from '../../components/RiskMeter';
import ApplicantModal from '../../components/ApplicantModal';

const TABS = [
  { key: 'ALL',          label: 'All',           icon: Clock },
  { key: 'APPROVED',     label: 'Approved',      icon: CheckCircle },
  { key: 'UNDER_REVIEW', label: 'Under Review',  icon: AlertTriangle },
  { key: 'DECLINED',     label: 'Declined',      icon: XCircle },
];

const DEC_COLOR = {
  APPROVED:     { text: '#02b946', bg: 'rgba(2,185,70,0.1)',  border: 'rgba(2,185,70,0.2)' },
  UNDER_REVIEW: { text: '#f5c518', bg: 'rgba(245,197,24,0.1)', border: 'rgba(245,197,24,0.2)' },
  DECLINED:     { text: '#ff3b4e', bg: 'rgba(255,59,78,0.1)', border: 'rgba(255,59,78,0.2)' },
};

export default function LenderHistory() {
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('ALL');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setRecords(await getLenderHistory()); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = records.filter(r => {
    const matchTab = tab === 'ALL' || r.decision === tab;
    const q = search.toLowerCase();
    const matchSearch = !q || r.applicant_id?.toLowerCase().includes(q)
      || r.full_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const counts = {
    ALL:          records.length,
    APPROVED:     records.filter(r => r.decision === 'APPROVED').length,
    UNDER_REVIEW: records.filter(r => r.decision === 'UNDER_REVIEW').length,
    DECLINED:     records.filter(r => r.decision === 'DECLINED').length,
  };

  if (loading) return (
    <div className="loading-center"><div className="spinner" /><span>Loading history…</span></div>
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <div className="page-title"><Clock size={22} /> Application History</div>
          <div className="page-subtitle">{filtered.length} of {records.length} total applications</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--bg-input)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        marginBottom: 20,
        width: 'fit-content',
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          const dc = DEC_COLOR[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-head)',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s',
                background: active
                  ? (dc ? dc.bg : 'var(--accent-dim)')
                  : 'transparent',
                color: active
                  ? (dc ? dc.text : 'var(--accent)')
                  : 'var(--text-muted)',
                boxShadow: active && !dc ? '0 0 16px var(--accent-glow)' : 'none',
              }}
            >
              <Icon size={13} />
              {t.label}
              <span style={{
                padding: '1px 6px',
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                background: active
                  ? (dc ? `${dc.text}20` : 'var(--accent-dim)')
                  : 'var(--bg-secondary)',
                color: active
                  ? (dc ? dc.text : 'var(--accent)')
                  : 'var(--text-muted)',
              }}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="input-field"
          style={{ paddingLeft: 36 }}
          placeholder="Search by name, ID, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Clock size={48} className="empty-icon" />
          <p>No applications found in this category.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Employment</th>
                  <th>Income</th>
                  <th>Loan</th>
                  <th>Risk Score</th>
                  <th>PD</th>
                  <th>Decision</th>
                  <th>Evaluated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const score = r.risk_score || 0;
                  const col   = getColor(score);
                  const dc    = DEC_COLOR[r.decision] || { text: 'var(--text-muted)', bg: 'var(--bg-input)', border: 'var(--border)' };

                  return (
                    <tr key={r.id} onClick={() => setSelected(r)}>
                      <td>
                        <div className="td-primary">{r.full_name || r.applicant_id}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.applicant_id}
                        </div>
                      </td>
                      <td style={{ textTransform: 'capitalize', fontSize: 12 }}>
                        {r.employment_type?.replace('_', ' ') || '—'}
                      </td>
                      <td className="td-mono">
                        {r.monthly_income ? `₹${Number(r.monthly_income).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="td-mono">
                        {r.loan_amount_requested ? `₹${Number(r.loan_amount_requested).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 36, height: 4, borderRadius: 2,
                            background: 'var(--border)', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${((score - 300) / 700) * 100}%`,
                              background: col,
                              borderRadius: 2,
                            }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'var(--font-mono)' }}>
                            {score}
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: col, fontFamily: 'var(--font-mono)', letterSpacing: 1, marginTop: 2 }}>
                          {getLabel(score)}
                        </div>
                      </td>
                      <td className="td-mono" style={{ fontSize: 12 }}>
                        {r.pd_value != null ? `${(r.pd_value * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 700,
                          color: dc.text,
                          background: dc.bg,
                          border: `1px solid ${dc.border}`,
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                        }}>
                          {r.decision?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="td-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.evaluated_at
                          ? new Date(r.evaluated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'right', paddingRight: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                          {r.decision !== 'UNDER_REVIEW' && (
                            r.is_email_sent ? (
                              <div title="Mail already sent" style={{ color: '#02b946', opacity: 0.8, display: 'flex' }}>
                                <CheckCircle size={14} />
                              </div>
                            ) : (
                              <button
                                className="btn btn-ghost btn-xs"
                                title="Send Result Mail"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Send decision email to ${r.full_name}?`)) {
                                    sendResultMail(r.id)
                                      .then(() => { alert('Result mail sent!'); load(); })
                                      .catch(err => alert(err.message || 'Failed to send mail'));
                                  }
                                }}
                                style={{ padding: 6, opacity: 0.7 }}
                              >
                                <Send size={13} />
                              </button>
                            )
                          )}
                          <ChevronRight size={14} color="var(--text-muted)" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <ApplicantModal applicant={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
