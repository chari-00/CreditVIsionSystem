// CreditVision — User Management (Admin)
import { useState, useEffect } from 'react';
import { Users, Plus, UserX, Search, RefreshCw, Shield, User } from 'lucide-react';
import { listUsers, createUser, deleteUser } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    user_id: '', full_name: '', email: '', password: '', role: 'lender'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
          <div>
            <h2 style={{ fontSize: 17 }}>Create New User</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              New users receive immediate system access.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="input-group">
                <label className="input-label">User ID</label>
                <input className="input-field" value={form.user_id}
                  onChange={e => set('user_id', e.target.value)}
                  placeholder="LENDER-002" required />
              </div>
              <div className="input-group">
                <label className="input-label">Role</label>
                <select className="input-field" value={form.role}
                  onChange={e => set('role', e.target.value)}>
                  <option value="lender">Lender</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input className="input-field" value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="Jane Smith" required />
            </div>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input-field" type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="jane@creditvision.in" required />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input className="input-field" type="password" value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min. 8 characters" required />
            </div>
            {error && (
              <div style={{
                color: '#ff3b4e', fontSize: 12, padding: '8px 12px',
                background: 'rgba(255,59,78,0.08)',
                border: '1px solid rgba(255,59,78,0.2)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
              }}>{error}</div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : <><Plus size={14} /> Create User</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setUsers(await listUsers()); }
    catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const promptDelete = (uid) => setPendingDelete(uid);

  const handleDelete = async (uid) => {
    setPendingDelete(null);
    setDeletingIds(prev => new Set([...prev, uid]));
    
    try { 
      await deleteUser(uid); 
      // Wait for animation to finish
      setTimeout(() => {
        setUsers(prev => prev.filter(u => u.user_id !== uid));
        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      }, 400);
    } catch (e) { 
      alert(e.message); 
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.user_id.toLowerCase().includes(q)
      || u.full_name.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || u.role.includes(q);
  });

  const counts = {
    total:    users.length,
    active:   users.filter(u => u.is_active).length,
    admin:    users.filter(u => u.role === 'admin').length,
    lender:   users.filter(u => u.role === 'lender').length,
  };

  if (loading) return (
    <div className="loading-center"><div className="spinner" /><span>Loading users…</span></div>
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <div className="page-title"><Users size={22} /> User Management</div>
          <div className="page-subtitle">
            {counts.active} active · {counts.admin} admins · {counts.lender} lenders
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New User
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4 mb-24">
        {[
          { label: 'Total Users',   value: counts.total,  icon: Users, color: 'var(--accent)' },
          { label: 'Active',        value: counts.active, icon: User,  color: '#02b946' },
          { label: 'Admins',        value: counts.admin,  icon: Shield, color: 'var(--accent)' },
          { label: 'Lenders',       value: counts.lender, icon: User,  color: '#4d49ff' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <span className="stat-label">{c.label}</span>
            <span className="stat-value" style={{ color: c.color }}>{c.value}</span>
            <div className="stat-icon"><c.icon size={20} /></div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 400 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="input-field"
          style={{ paddingLeft: 36 }}
          placeholder="Search by name, ID, email or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Users grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {filtered.map(u => {
          const roleColor = { admin: 'var(--accent)', lender: '#4d49ff' }[u.role] || 'var(--text-muted)';
          const initial   = (u.full_name || u.user_id)[0].toUpperCase();

          return (
            <div key={u.user_id} className={`card ${deletingIds.has(u.user_id) ? 'delete-exit' : ''}`} style={{
              display: 'flex', flexDirection: 'column', gap: 14,
              opacity: u.is_active ? 1 : 0.5,
              border: u.is_active ? '1px solid var(--border)' : '1px dashed var(--border)',
            }}>
              {/* User header */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: `${roleColor}20`,
                  border: `2px solid ${roleColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: roleColor,
                  flexShrink: 0,
                }}>
                  {initial}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {u.user_id}
                  </div>
                </div>
                <span style={{
                  padding: '3px 9px', borderRadius: 99,
                  fontSize: 10, fontWeight: 700,
                  color: roleColor, background: `${roleColor}15`,
                  border: `1px solid ${roleColor}30`,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase', flexShrink: 0,
                }}>{u.role}</span>
              </div>

              {/* Details */}
              <div style={{
                padding: '10px 12px',
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                  {u.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Joined {new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 10, fontWeight: 700,
                    color: u.is_active ? '#02b946' : '#ff3b4e',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: u.is_active ? '#02b946' : '#ff3b4e',
                      display: 'inline-block',
                      animation: u.is_active ? 'pulse 2s infinite' : 'none',
                    }} />
                    {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>

              {/* Action */}
              {u.role !== 'admin' && (
                <button
                  className="btn btn-danger btn-sm w-full"
                  onClick={() => promptDelete(u.user_id)}
                  style={{ justifyContent: 'center' }}
                >
                  <UserX size={13} /> Delete Account
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {pendingDelete && (
        <ConfirmModal 
          title="Delete User Account?"
          message={`Are you sure you want to delete ${pendingDelete} permanently? This action cannot be undone.`}
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
