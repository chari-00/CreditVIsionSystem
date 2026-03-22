// CreditVision — Data Monitoring (Admin)
import { useState, useEffect } from 'react';
import { Database, Search, Filter, RefreshCw, ChevronDown } from 'lucide-react';
import { getAllApplicants } from '../../services/api';
import ApplicantModal from '../../components/ApplicantModal';
import RiskMeter, { getColor, getLabel } from '../../components/RiskMeter';

const DEC_COLORS = {
  APPROVED:     { bg: 'rgba(2,185,70,0.1)',  text: '#02b946',  border: 'rgba(2,185,70,0.2)' },
  UNDER_REVIEW: { bg: 'rgba(245,197,24,0.1)', text: '#f5c518', border: 'rgba(245,197,24,0.2)' },
  DECLINED:     { bg: 'rgba(255,59,78,0.1)', text: '#ff3b4e',  border: 'rgba(255,59,78,0.2)' },
};

export default function DataMonitoring() {
  const [applicants, setApplicants] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [filter,     setFilter]     = useState('ALL'); // ALL | APPROVED | UNDER_REVIEW | DECLINED
  const [selected,   setSelected]   = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());

  const handleDeleted = (id) => {
    setDeletingIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setApplicants(prev => prev.filter(a => a.id !== id));
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  };

  const load = async () => {
    setLoading(true);
    try { const d = await getAllApplicants(); setApplicants(d); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = applicants.filter(a => {
    const matchSearch = !search || [a.applicant_id, a.full_name, a.email]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter === 'ALL' || a.decision === filter;
    return matchSearch && matchFilter;
  });

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span>Loading applicant data…</span>
    </div>
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <div className="page-title"><Database size={22} /> Data Monitoring</div>
          <div className="page-subtitle">{filtered.length} of {applicants.length} applicants · Full scoring audit trail</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            style={{ paddingLeft: 36 }}
            placeholder="Search by name, ID, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', 'APPROVED', 'UNDER_REVIEW', 'DECLINED'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <Database size={48} className="empty-icon" />
          <p>No applicants found. Score some applicants to see data here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(a => {
            const score = a.risk_score || 500;
            const col   = getColor(score);
            const label = getLabel(score);
            const dec   = a.decision || 'UNKNOWN';
            const dc    = DEC_COLORS[dec] || { bg: 'var(--bg-input)', text: 'var(--text-muted)', border: 'var(--border)' };

            return (
              <div
                key={a.id}
                className={`card ${deletingIds.has(a.id) ? 'delete-exit' : ''}`}
                style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}
                onClick={() => setSelected(a)}
              >
                {/* Top bar */}
                <div style={{
                  height: 4,
                  background: `linear-gradient(90deg, ${col}, ${col}66)`,
                }} />

                <div style={{ padding: '20px 22px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                        {a.full_name || a.applicant_id}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {a.applicant_id}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: dc.text,
                      background: dc.bg,
                      border: `1px solid ${dc.border}`,
                      whiteSpace: 'nowrap',
                    }}>{dec}</span>
                  </div>

                  {/* Mini gauge row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                    <RiskMeter score={score} size={120} showLabel={false} />
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: col, letterSpacing: -1 }}>{score}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: col, fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                        PD: {a.pd_value != null ? (a.pd_value * 100).toFixed(2) + '%' : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    padding: '12px 14px',
                    background: 'var(--bg-input)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                  }}>
                    {[
                      { l: 'Income',  v: a.monthly_income  ? `₹${Number(a.monthly_income).toLocaleString('en-IN')}` : '—' },
                      { l: 'Age',     v: a.age ? `${a.age}y` : '—' },
                      { l: 'Employment', v: a.employment_type || '—' },
                      { l: 'Evaluated', v: a.evaluated_at ? new Date(a.evaluated_at).toLocaleDateString('en-IN') : '—' },
                    ].map(item => (
                      <div key={item.l}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>{item.l}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* SHAP mini */}
                  {a.key_risk_drivers?.drivers?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Top Risk Drivers</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {a.key_risk_drivers.drivers.slice(0, 4).map((d, i) => (
                          <span key={i} style={{
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 600,
                            color: d.direction === 'RISK' ? '#ff3b4e' : '#02b946',
                            background: d.direction === 'RISK' ? 'rgba(255,59,78,0.08)' : 'rgba(2,185,70,0.08)',
                            border: `1px solid ${d.direction === 'RISK' ? 'rgba(255,59,78,0.2)' : 'rgba(2,185,70,0.2)'}`,
                          }}>
                            {d.direction === 'RISK' ? '↑' : '↓'} {d.feature.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <ApplicantModal applicant={selected} onClose={() => setSelected(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
