// CreditVision — Admin Dashboard
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Activity, TrendingUp,
  CheckCircle, Clock, XCircle, Zap, Plus, UserX, RefreshCw,
} from 'lucide-react';
import { getAdminStats, listUsers, createUser, deleteUser } from '../../services/api';

function StatCard({ label, value, icon: Icon, color = 'var(--accent)', sub }) {
  return (
    <div className="stat-card animate-in">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{sub}</span>}
      <div className="stat-icon"><Icon size={22} /></div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ user_id: '', full_name: '', email: '', password: '', role: 'lender' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await createUser(form);
      onCreated();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: 17 }}>Create New User</h2>
          <button className="modal-close" onClick={onClose}><XCircle size={16} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'User ID',   key: 'user_id',   placeholder: 'LENDER-002' },
              { label: 'Full Name', key: 'full_name',  placeholder: 'Jane Smith' },
              { label: 'Email',     key: 'email',      placeholder: 'jane@example.com', type: 'email' },
              { label: 'Password',  key: 'password',   placeholder: '••••••••',         type: 'password' },
            ].map(f => (
              <div className="input-group" key={f.key}>
                <label className="input-label">{f.label}</label>
                <input
                  className="input-field"
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  type={f.type || 'text'}
                  required
                />
              </div>
            ))}
            <div className="input-group">
              <label className="input-label">Role</label>
              <select className="input-field" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="lender">Lender</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div style={{ color: '#ff3b4e', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([getAdminStats(), listUsers()]);
      setStats(s);
      setUsers(u);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (uid) => {
    if (!confirm(`Delete user ${uid} permanently?`)) return;
    try { await deleteUser(uid); load(); } catch (e) { alert(e.message); }
  };

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span>Loading dashboard…</span>
    </div>
  );

  const roleColor = { admin: 'var(--accent)', lender: '#4d49ff' };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <div className="page-title"><LayoutDashboard size={22} /> Admin Dashboard</div>
          <div className="page-subtitle">System overview · {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid-4 mb-24">
          <StatCard label="Total Scored"    value={stats.total_scored}    icon={Zap}         sub={`Model ${stats.model_version}`} />
          <StatCard label="Approved"        value={stats.approved}        icon={CheckCircle}  color="#02b946" sub={`${stats.total_scored ? Math.round(stats.approved / stats.total_scored * 100) : 0}% approval`} />
          <StatCard label="Under Review"    value={stats.under_review}    icon={Clock}        color="#f5c518" />
          <StatCard label="Declined"        value={stats.declined}        icon={XCircle}      color="#ff3b4e" />
          <StatCard label="Avg Risk Score"  value={stats.avg_risk_score}  icon={TrendingUp}   color="var(--accent)" />
          <StatCard label="Avg PD"          value={`${(stats.avg_pd * 100).toFixed(2)}%`} icon={Activity} color="#ff7a1a" sub="Probability of Default" />
          <StatCard label="Cold Start"      value={stats.cold_start_count} icon={Zap}         color="#4d49ff" sub="No bureau history" />
          <StatCard label="Total Users"     value={stats.total_users}     icon={Users} />
        </div>
      )}

      {/* Users table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} /> System Users
            <span style={{
              padding: '2px 8px',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              borderRadius: 99,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}>{users.length}</span>
          </h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New User
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td className="td-mono td-primary">{u.user_id}</td>
                  <td className="td-primary">{u.full_name}</td>
                  <td className="td-mono text-muted" style={{ fontSize: 12 }}>{u.email}</td>
                  <td>
                    <span className={`badge badge-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 700,
                      color: u.is_active ? '#02b946' : '#ff3b4e',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: u.is_active ? '#02b946' : '#ff3b4e',
                        display: 'inline-block',
                        boxShadow: u.is_active ? '0 0 6px #02b946' : 'none',
                      }} />
                      {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="td-mono text-muted" style={{ fontSize: 11 }}>
                    {new Date(u.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    {u.role !== 'admin' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(u.user_id)}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        <UserX size={11} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}
