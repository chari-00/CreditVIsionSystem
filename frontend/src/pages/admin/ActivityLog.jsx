// CreditVision — Activity Log (Admin)
import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Search, LogIn, LogOut, Zap, Users, Eye } from 'lucide-react';
import { getActivityLogs } from '../../services/api';

const ACTION_META = {
  LOGIN:         { icon: LogIn,   color: '#02b946',  bg: 'rgba(2,185,70,0.08)',   label: 'Login' },
  LOGOUT:        { icon: LogOut,  color: '#f5c518',  bg: 'rgba(245,197,24,0.08)', label: 'Logout' },
  SCORE:         { icon: Zap,     color: 'var(--accent)', bg: 'var(--accent-3)',  label: 'Score' },
  CREATE_USER:   { icon: Users,   color: '#4d49ff',  bg: 'rgba(77,73,255,0.08)',  label: 'Created User' },
  VIEW_APPLICANT:{ icon: Eye,     color: '#ff7a1a',  bg: 'rgba(255,122,26,0.08)', label: 'Viewed' },
  DEACTIVATE_USER:{ icon: Users,  color: '#ff3b4e',  bg: 'rgba(255,59,78,0.08)', label: 'Deactivated' },
};

export default function ActivityLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const load = async () => {
    setLoading(true);
    try { setLogs(await getActivityLogs(200)); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const actions = ['ALL', ...new Set(logs.map(l => l.action))];
  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.user_id?.toLowerCase().includes(q)
      || l.detail?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q);
    const matchAction = filterAction === 'ALL' || l.action === filterAction;
    return matchSearch && matchAction;
  });

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span>Loading activity log…</span>
    </div>
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <div className="page-title"><Activity size={22} /> Activity Log</div>
          <div className="page-subtitle">{filtered.length} of {logs.length} entries · Global audit trail</div>
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
            placeholder="Search user, action, detail…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {actions.slice(0, 7).map(a => (
            <button
              key={a}
              className={`btn btn-sm ${filterAction === a ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilterAction(a)}
            >
              {a.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} className="empty-icon" />
          <p>No activity found. Actions will appear here as users interact with the system.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Activity</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {filtered.length} events
            </span>
          </div>

          {/* Timeline */}
          <div style={{ padding: '8px 0' }}>
            {filtered.map((log, i) => {
              const meta = ACTION_META[log.action] || {
                icon: Activity, color: 'var(--text-muted)',
                bg: 'var(--bg-input)', label: log.action
              };
              const Icon = meta.icon;
              const ts   = new Date(log.created_at);
              const isToday = ts.toDateString() === new Date().toDateString();

              return (
                <div key={log.id} style={{
                  display: 'flex',
                  gap: 16,
                  padding: '12px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background var(--transition)',
                  cursor: 'default',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: meta.bg,
                    border: `1px solid ${meta.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={15} color={meta.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{log.user_id}</span>
                      <span style={{
                        padding: '1px 7px',
                        borderRadius: 99,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        color: meta.color,
                        background: meta.bg,
                        fontFamily: 'var(--font-mono)',
                        textTransform: 'uppercase',
                      }}>{meta.label}</span>
                    </div>
                    {log.detail && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 500,
                      }}>
                        {log.detail}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                    textAlign: 'right',
                    lineHeight: 1.4,
                  }}>
                    {isToday ? 'Today' : ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    <br />
                    {ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
