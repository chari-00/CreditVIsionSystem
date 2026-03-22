// CreditVision — Custom Confirmation Modal
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ 
  title = "Are you sure?", 
  message = "This action cannot be undone.", 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel,
  variant = "danger" 
}) {
  const accentColor = variant === "danger" ? "#ff3b4e" : "var(--accent)";

  return (
    <div className="modal-overlay" style={{ zIndex: 110 }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ maxWidth: 400, border: `1px solid ${accentColor}40` }}>
        <div style={{ padding: '24px 28px', textAlign: 'center' }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%', 
            background: `${accentColor}15`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px',
            color: accentColor,
            border: `1px solid ${accentColor}30`
          }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{title}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        </div>
        
        <div style={{ 
          padding: '16px 24px 24px', 
          display: 'flex', 
          gap: 12, 
          justifyContent: 'center' 
        }}>
          <button 
            className="btn btn-ghost" 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
            style={{ minWidth: 100 }}
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfirm(); }}
            style={{ 
              minWidth: 100, 
              background: variant === 'danger' ? accentColor : undefined,
              color: '#fff'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
