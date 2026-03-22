// CreditVision — Theme Toggle
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return (localStorage.getItem('cv_theme') || 'dark') === 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('cv_theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      onClick={() => setDark(d => !d)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-glass)',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        transition: 'all var(--transition)',
      }}
      title="Toggle theme"
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}
