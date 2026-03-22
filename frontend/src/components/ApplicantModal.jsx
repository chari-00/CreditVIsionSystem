// CreditVision — Applicant Detail Modal
import { useState } from 'react';
import { X, User, CreditCard, Activity, Database, Send, CheckCircle, Trash2 } from 'lucide-react';
import RiskMeter, { getColor, getLabel } from './RiskMeter';
import SHAPPanel from './SHAPPanel';
import { sendResultMail, deleteApplicantAdmin, isAdmin, isLender, updateDecision } from '../services/api';

const INR = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const PCT = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';
const NUM = (v) => v != null ? v : 'N/A';

function Field({ label, value, mono = false }) {
  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      }}>{value ?? '—'}</div>
    </div>
  );
}

export default function ApplicantModal({ applicant, onClose, onDeleted }) {
  const [mailLoading, setMailLoading] = useState(false);
  const [mailSent, setMailSent] = useState(applicant.is_email_sent || false);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [localDecision, setLocalDecision] = useState(applicant.decision || 'UNKNOWN');
  const [decisionLoading, setDecisionLoading] = useState(false);

  if (!applicant) return null;

  const score  = applicant.risk_score || 500;
  const color  = getColor(score);
  const label  = getLabel(score);
  const dec    = localDecision;

  const decColor = {
    APPROVED:     '#02b946',
    UNDER_REVIEW: '#f5c518',
    DECLINED:     '#ff3b4e',
  }[dec] || 'var(--text-muted)';

  const handleUpdateDec = async (newDec) => {
    setDecisionLoading(true); setError('');
    try {
      await updateDecision(applicant.id, { decision: newDec });
      setLocalDecision(newDec);
      if (onDeleted) onDeleted(applicant.id); // Triggers parent reload
    } catch (err) {
      setError(err.message || `Failed to ${newDec.toLowerCase()}`);
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleDelete = async (e) => {
    if (e) e.stopPropagation();
    try {
      await deleteApplicantAdmin(applicant.id);
      if (onDeleted) onDeleted(applicant.id);
      onClose();
    } catch (err) {
      setError('Failed to delete applicant.');
    }
  };

  const handleSendMail = async (e) => {
    if (e) e.stopPropagation();
    setMailLoading(true); setError('');
    try {
      await sendResultMail(applicant.id);
      setMailSent(true);
    } catch (err) {
      if (err.message?.includes('already been sent')) {
        setMailSent(true);
        setError('Email was already sent for this applicant.');
      } else {
        setError(err.message || 'Failed to send mail.');
      }
    } finally {
      setMailLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 800 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 17, marginBottom: 2 }}>
                {applicant.full_name || applicant.applicant_id}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {applicant.applicant_id} · {applicant.email || 'No email'} · Evaluated {
                  applicant.evaluated_at
                    ? new Date(applicant.evaluated_at).toLocaleString('en-IN')
                    : '—'
                }
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {dec === 'UNDER_REVIEW' && (isLender() || isAdmin()) && (
                <>
                  <button className="btn btn-sm" disabled={decisionLoading} onClick={(e) => { e.stopPropagation(); handleUpdateDec('APPROVED'); }} style={{ background: 'transparent', border: '1px solid #02b946', color: '#02b946', fontWeight: 700, letterSpacing: 0.5, boxShadow: 'none' }}>APPROVE</button>
                  <button className="btn btn-sm" disabled={decisionLoading} onClick={(e) => { e.stopPropagation(); handleUpdateDec('DECLINED'); }} style={{ background: 'transparent', border: '1px solid #ff3b4e', color: '#ff3b4e', fontWeight: 700, letterSpacing: 0.5, boxShadow: 'none' }}>DECLINE</button>
                </>
              )}
              {dec !== 'UNDER_REVIEW' && (
                !mailSent ? (
                  <button 
                    className="btn btn-ghost btn-sm" 
                    onClick={handleSendMail}
                    disabled={mailLoading}
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  >
                    {mailLoading ? 'Sending...' : <><Send size={13} /> Send Result Mail</>}
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: '#02b946', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} /> Mail Sent
                  </span>
                )
              )}
              {isAdmin() && (
                !showConfirm ? (
                  <button 
                    className="btn btn-danger btn-sm" 
                    onClick={() => setShowConfirm(true)}
                    style={{ background: 'rgba(255,59,78,0.1)', border: '1px solid rgba(255,59,78,0.2)' }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,59,78,0.1)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,59,78,0.2)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ff3b4e' }}>Confirm?</span>
                    <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{ padding: '2px 8px', fontSize: 10 }}>Yes</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowConfirm(false)} style={{ padding: '2px 8px', fontSize: 10, border: 'none' }}>No</button>
                  </div>
                )
              )}
              <button className="modal-close" onClick={onClose} style={{ position: 'static' }}><X size={16} /></button>
            </div>
          </div>
        </div>

        <div className="modal-body">
          {error && <div style={{ background: 'rgba(255,59,78,0.1)', color: '#ff3b4e', padding: '10px 14px', borderRadius: 6, marginBottom: 20, fontSize: 13, border: '1px solid rgba(255,59,78,0.2)' }}>{error}</div>}
          
          {/* Gauge + Decision */}
          <div style={{
            display: 'flex',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            padding: '24px 32px',
            marginBottom: 24,
            border: '1px solid var(--border)',
          }}>
            <RiskMeter score={score} size={240} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 160 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>Risk Score</div>
                <div style={{ fontSize: 36, fontWeight: 800, color, letterSpacing: -1 }}>{score}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>{label}</div>
              </div>
              <div className="divider" />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>Decision</div>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  color: decColor,
                  background: `${decColor}18`,
                  border: `1px solid ${decColor}40`,
                  fontFamily: 'var(--font-mono)',
                }}>{dec}</span>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>PD Value</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {applicant.pd_value != null ? (applicant.pd_value * 100).toFixed(2) + '%' : '—'}
                </div>
              </div>
              {applicant.cold_start_flag && (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#f5c518',
                  background: 'rgba(245,197,24,0.1)',
                  border: '1px solid rgba(245,197,24,0.2)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}>⚡ Cold Start</span>
              )}
            </div>
          </div>

          {/* I. Entity */}
          <div className="form-section">
            <div className="form-section-title"><User size={12} style={{ display: 'inline', marginRight: 6 }} />Entity Identification</div>
            <div className="grid-3" style={{ gap: 10 }}>
              <Field label="Applicant ID"   value={applicant.applicant_id} mono />
              <Field label="Age"            value={`${NUM(applicant.age)} yrs`} />
              <Field label="Employment"     value={applicant.employment_type} />
            </div>
          </div>

          {/* II. Core Financials */}
          <div className="form-section">
            <div className="form-section-title"><CreditCard size={12} style={{ display: 'inline', marginRight: 6 }} />Core Financials</div>
            <div className="grid-3" style={{ gap: 10 }}>
              <Field label="Monthly Income"     value={INR(applicant.monthly_income)} />
              <Field label="Loan Requested"     value={INR(applicant.loan_amount_requested)} />
              <Field label="Tenure"             value={`${NUM(applicant.loan_tenure_months)} mo`} />
              <Field label="Total EMI"          value={INR(applicant.total_emi_monthly)} />
              <Field label="Bureau Score"       value={applicant.bureau_credit_score ?? 'N/A (Cold Start)'} mono />
              <Field label="Existing Loans"     value={NUM(applicant.existing_loans_count)} />
              <Field label="Credit Enquiries 6M" value={NUM(applicant.credit_enquiries_6m)} />
              <Field label="Credit History"     value={`${NUM(applicant.credit_history_months)} mo`} />
            </div>
          </div>

          {/* III. Transaction Analytics */}
          <div className="form-section">
            <div className="form-section-title"><Activity size={12} style={{ display: 'inline', marginRight: 6 }} />Transaction Analytics</div>
            <div className="grid-3" style={{ gap: 10 }}>
              <Field label="Avg Transactions/Mo" value={NUM(applicant.monthly_avg_transactions)} />
              <Field label="Avg Monthly Spend"   value={INR(applicant.monthly_avg_spend)} />
              <Field label="Avg Balance"          value={INR(applicant.monthly_avg_balance)} />
              <Field label="Salary Regularity"    value={PCT(applicant.salary_credit_regularity)} />
              <Field label="UPI Bounce Rate"      value={PCT(applicant.upi_bounce_rate)} />
              <Field label="Txn History"          value={`${NUM(applicant.months_of_txn_history)} mo`} />
            </div>
          </div>

          {/* IV. Alternative Risk Data */}
          <div className="form-section">
            <div className="form-section-title"><Database size={12} style={{ display: 'inline', marginRight: 6 }} />Alternative Risk Data</div>
            <div className="grid-3" style={{ gap: 10 }}>
              <Field label="BNPL Active"         value={applicant.bnpl_active ? 'YES' : 'NO'} />
              <Field label="BNPL Repay Score"    value={applicant.bnpl_repayment_score != null ? PCT(applicant.bnpl_repayment_score) : 'N/A'} />
              <Field label="Insurance Active"    value={applicant.insurance_premium_active ? 'YES' : 'NO'} />
              <Field label="Min Bal Breaches"    value={NUM(applicant.min_balance_breach_count)} />
              <Field label="Bills On Time"       value={PCT(applicant.bill_payments_on_time_pct)} />
            </div>
          </div>

          {/* SHAP */}
          {(applicant.key_risk_drivers || applicant.shap_values) && (
            <div className="form-section">
              <SHAPPanel keyDrivers={applicant.key_risk_drivers} shapValues={applicant.shap_values} riskBand={applicant.risk_band} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
