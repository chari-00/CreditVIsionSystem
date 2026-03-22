// CreditVision — Login Page
import { useState } from 'react';
import { Eye, EyeOff, Zap, Shield, ChevronRight, AlertCircle } from 'lucide-react';
import { login } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

export default function Login({ onLogin }) {
  const [userId,   setUserId]   = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [tab,      setTab]      = useState('admin');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId || !password) { setError('Please enter credentials.'); return; }
    setLoading(true); setError('');
    try {
      const data = await login(userId, password);
      onLogin(data.role);
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 800,
        height: 800,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
        pointerEvents: 'none',
        opacity: 0.3,
        animation: 'pulse 4s ease-in-out infinite',
      }} />

      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 100 }}>
        <ThemeToggle />
      </div>

      <div className="animate-in" style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 480,
      }}>
        {/* App Branding */}
        <div style={{ marginBottom: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.6s ease-out' }}>
          <div style={{
            width: 120, height: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
            borderRadius: 24,
            overflow: 'hidden',
            boxShadow: '0 0 32px var(--accent-glow)',
            animation: 'glow 3s ease-in-out infinite',
          }}>
            <img src="/CV_Logo.png" alt="CreditVision" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          
          <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1.5, color: 'var(--text-primary)', marginBottom: 12 }}>
            Credit<span style={{ color: 'var(--accent)' }}>Vision</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8, lineHeight: 1.3, color: 'var(--text-secondary)' }}>
            Welcome back,<br />
            <span style={{ color: 'var(--accent)' }}>sign in to continue.</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 300, lineHeight: 1.5 }}>
            Real-time alternative credit scoring engine powered by explainable AI.
          </p>
        </div>

        {/* Role tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-input)',
          borderRadius: 'var(--radius-sm)',
          padding: 4,
          marginBottom: 24,
          border: '1px solid var(--border)',
          width: 'fit-content',
        }}>
          {['admin', 'lender'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              style={{
                padding: '8px 24px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-head)',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s',
                textTransform: 'capitalize',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
                boxShadow: tab === t ? '0 0 16px var(--accent-glow)' : 'none',
              }}
            >
              {t === 'admin' ? '🔐 Admin' : '🏦 Lender'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="glowing-container" style={{ width: '100%', animation: 'slideUp 0.5s ease-out 0.1s both' }}>
          <div className="glowing-content" style={{ padding: '32px 36px' }}>
            <form onSubmit={handleSubmit}>
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">User ID</label>
                <input
                  className="input-field"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder={tab === 'admin' ? 'Enter ADMIN ID' : 'Enter USER ID'}
                  autoComplete="username"
                />
              </div>

              <div className="input-group" style={{ marginBottom: 24 }}>
                <label className="input-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(s => !s)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px',
                  background: 'rgba(255,59,78,0.08)',
                  border: '1px solid rgba(255,59,78,0.2)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ff3b4e',
                  fontSize: 13,
                  marginBottom: 16,
                }}>
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
                style={{ justifyContent: 'center' }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    Authenticating…
                  </span>
                ) : (
                  <>Sign In <ChevronRight size={16} /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

