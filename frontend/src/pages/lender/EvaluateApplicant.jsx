// CreditVision — Evaluate Applicant (Lender)
import { useState, useEffect } from 'react';
import {
  Zap, RefreshCw, User, CreditCard, Activity, Database,
  CheckCircle, Clock, XCircle, AlertCircle, ChevronRight,
} from 'lucide-react';
import { scoreApplicant, getTestData, checkApplicantExists } from '../../services/api';
import RiskMeter, { getColor, getLabel } from '../../components/RiskMeter';
import SHAPPanel from '../../components/SHAPPanel';

// Synthetic data generator using test_inputs.json with jitter
function getJitteredData(baseEntry) {
  if (!baseEntry || !baseEntry.applicant) return baseEntry;
  const data = JSON.parse(JSON.stringify(baseEntry.applicant));
  const r = () => Math.random() * 0.3 - 0.15; // Increased jitter to +/- 15% for more score variation

  // Apply jitter to key numeric fields to vary risk score
  const jitterFields = [
    'monthly_income', 'loan_amount_requested', 'total_emi_monthly',
    'monthly_avg_spend', 'monthly_avg_balance', 'bureau_credit_score'
  ];

  jitterFields.forEach(f => {
    if (typeof data[f] === 'number') {
      data[f] = Math.round(data[f] * (1 + r()));
      if (f === 'bureau_credit_score') data[f] = Math.max(300, Math.min(900, data[f]));
      if (data[f] < 0) data[f] = 0;
    }
  });

  // Randomize boolean risk factors occasionally
  if (Math.random() > 0.8) data.bnpl_active = !data.bnpl_active;
  if (Math.random() > 0.8) data.upi_bounce_rate = Math.min(1, Math.max(0, data.upi_bounce_rate + r()));

  // Round percentages
  ['upi_bounce_rate', 'bill_payments_on_time_pct', 'salary_credit_regularity', 'bnpl_repayment_score', 'cashflow_volatility'].forEach(f => {
    if (typeof data[f] === 'number') {
      data[f] = Math.round(data[f] * 100) / 100;
    }
  });

  // Ensure unique ID for UI
  data.applicant_id = `APP-S${Math.floor(Math.random() * 9000 + 1000)}`;
  
  return data;
}

const FIELD_GROUPS = [
  {
    title: 'I. Entity Identification',
    icon: User,
    fields: [
      { key: 'applicant_id', label: 'Applicant ID', type: 'text', col: 1 },
      { key: 'full_name',    label: 'Full Name',    type: 'text', col: 1 },
      { key: 'email',        label: 'Email',        type: 'email', col: 1 },
      { key: 'age',          label: 'Age',          type: 'number', min: 18, max: 80, col: 1 },
      {
        key: 'employment_type', label: 'Employment Type', type: 'select', col: 1,
        options: ['salaried','self_employed','gig','unemployed'],
      },
    ],
  },
  {
    title: 'II. Core Financials',
    icon: CreditCard,
    fields: [
      { key: 'monthly_income',        label: 'Monthly Income (₹)',       type: 'number', prefix: '₹' },
      { key: 'loan_amount_requested', label: 'Loan Requested (₹)',        type: 'number', prefix: '₹' },
      { key: 'loan_tenure_months',    label: 'Tenure (Months)',           type: 'number', min: 3, max: 360 },
      { key: 'total_emi_monthly',     label: 'Total EMI (₹) — Optional', type: 'number', optional: true },
      { key: 'bureau_credit_score',   label: 'Bureau Score — Optional',   type: 'number', optional: true, min: 300, max: 900 },
      { key: 'existing_loans_count',  label: 'Existing Loans — Optional', type: 'number', optional: true, min: 0 },
      { key: 'credit_enquiries_6m',   label: 'Credit Enquiries 6M',       type: 'number', optional: true, min: 0 },
      { key: 'credit_history_months', label: 'Credit History (Mo)',        type: 'number', optional: true, min: 0 },
    ],
  },
  {
    title: 'III. Transaction Analytics',
    icon: Activity,
    fields: [
      { key: 'monthly_avg_transactions',  label: 'Avg Transactions / Month', type: 'number', min: 0 },
      { key: 'monthly_avg_spend',         label: 'Avg Monthly Spend (₹)',    type: 'number', prefix: '₹' },
      { key: 'monthly_avg_balance',       label: 'Avg Balance (₹)',          type: 'number', prefix: '₹' },
      { key: 'salary_credit_regularity',  label: 'Salary Regularity (0-1)', type: 'number', step: '0.01', min: 0, max: 1 },
      { key: 'upi_bounce_rate',           label: 'UPI Bounce Rate (0-1)',    type: 'number', step: '0.01', min: 0, max: 1 },
      { key: 'months_of_txn_history',     label: 'Transaction History (Mo)', type: 'number', min: 1 },
    ],
  },
  {
    title: 'IV. Alternative Risk Data',
    icon: Database,
    fields: [
      { key: 'bnpl_repayment_score',     label: 'BNPL Repay Score (0-1)', type: 'number', step: '0.01', optional: true, min: 0, max: 1 },
      { key: 'min_balance_breach_count', label: 'Min Balance Breaches',    type: 'number', min: 0 },
      { key: 'bill_payments_on_time_pct',label: 'Bills On Time (0-1)',     type: 'number', step: '0.01', min: 0, max: 1 },
    ],
    booleans: [
      { key: 'bnpl_active',             label: 'BNPL Active' },
      { key: 'insurance_premium_active', label: 'Insurance Active' },
    ],
  },
];

function ScoreModal({ result: initialResult, onClose }) {
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [mailSent, setMailSent] = useState(false);
  const [error, setError] = useState('');

  const score = result?.risk_score || 500;
  const color = getColor(score);
  const label = getLabel(score);
  const dec   = result?.decision || '';

  const decColor = { APPROVED: '#02b946', UNDER_REVIEW: '#f5c518', DECLINED: '#ff3b4e' }[dec] || '#888';
  const DecIcon  = { APPROVED: CheckCircle, UNDER_REVIEW: Clock, DECLINED: XCircle }[dec] || Zap;

  const handleUpdateDecision = async (newDec) => {
    setLoading(true); setError('');
    try {
      const res = await import('../../services/api').then(m => m.updateDecision(result.id, { decision: newDec }));
      setResult(prev => ({ ...prev, decision: res.new_decision }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMail = async () => {
    setLoading(true); setError('');
    try {
      await import('../../services/api').then(m => m.sendResultMail(result.id));
      setMailSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const drivers = result?.key_risk_drivers || [];

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 500, textAlign: 'center' }}>
        <div className="modal-header" style={{ justifyContent: 'center', borderBottom: 'none', paddingBottom: 0 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <img src="/CV_Logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        <div className="modal-body" style={{ paddingTop: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Analysis Result</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>System ID: {result?.applicant_id}</p>

          {/* Gauge */}
          <div style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px 24px',
            marginBottom: 20,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <RiskMeter score={score} size={260} />
          </div>

          {/* Recommendation */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px',
            background: `${decColor}10`,
            border: `1px solid ${decColor}30`,
            borderRadius: 'var(--radius-sm)',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <DecIcon size={16} color={decColor} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Recommendation</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: decColor, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
              {dec.replace('_', ' ')}
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Risk Score</span>
            <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
              {score}<span style={{ fontSize: 12, opacity: 0.5 }}>/1000</span>
            </span>
          </div>

          {/* SHAP */}
          {(drivers.length > 0) && (
            <SHAPPanel 
              keyDrivers={drivers} 
              riskBand={result.risk_band} 
            />
          )}

          {error && <div style={{ color: '#ff3b4e', fontSize: 12, marginBottom: 12 }}>{error}</div>}

          {/* Conditional Actions */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
            {dec === 'UNDER_REVIEW' ? (
              <>
                <button
                  className="btn"
                  onClick={() => handleUpdateDecision('APPROVED')}
                  disabled={loading}
                  style={{ background: 'transparent', border: '1px solid #02b946', color: '#02b946', fontWeight: 700, letterSpacing: 0.5, padding: '12px 24px', boxShadow: 'none' }}
                >
                  APPROVE APPLICATION
                </button>
                <button
                  className="btn"
                  onClick={() => handleUpdateDecision('DECLINED')}
                  disabled={loading}
                  style={{ background: 'transparent', border: '1px solid #ff3b4e', color: '#ff3b4e', fontWeight: 700, letterSpacing: 0.5, padding: '12px 24px', boxShadow: 'none' }}
                >
                  DECLINE APPLICATION
                </button>
              </>
            ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                  Assessment Complete. Details are now available in Unified History and Approved sections.
                </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
          <button className="btn btn-ghost w-full" onClick={onClose} style={{ justifyContent: 'center' }}>
            Close Overlay
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluateApplicant() {
  const [form,     setForm]    = useState({});
  const [testData, setTestData] = useState([]);
  const [loading,  setLoading] = useState(false);
  const [result,   setResult]  = useState(null);
  const [error,    setError]   = useState('');

  // Fetch test data on mount
  useEffect(() => {
    getTestData().then(data => {
      setTestData(data);
      if (data.length > 0) {
        setForm(getJitteredData(data[Math.floor(Math.random() * data.length)]));
      }
    }).catch(() => {
      // No fallback if test data fails, but we could add one if needed
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const regen = () => {
    if (testData.length > 0) {
      const entry = testData[Math.floor(Math.random() * testData.length)];
      setForm(getJitteredData(entry));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // 1. Check for duplicate applicant ID
      const { exists } = await checkApplicantExists(form.applicant_id);
      if (exists) {
        const confirm = window.confirm(`Applicant ID ${form.applicant_id} already exists. Would you like to update their scores?`);
        if (!confirm) {
          setLoading(false);
          return;
        }
      }

      // 2. Cast types properly
      const payload = {
        ...form,
        age:                       parseInt(form.age),
        monthly_income:            parseFloat(form.monthly_income),
        loan_amount_requested:     parseFloat(form.loan_amount_requested),
        loan_tenure_months:        parseInt(form.loan_tenure_months),
        total_emi_monthly:         form.total_emi_monthly != null ? parseFloat(form.total_emi_monthly) : null,
        bureau_credit_score:       form.bureau_credit_score != null ? parseInt(form.bureau_credit_score) : null,
        existing_loans_count:      form.existing_loans_count != null ? parseInt(form.existing_loans_count) : null,
        credit_enquiries_6m:       form.credit_enquiries_6m != null ? parseInt(form.credit_enquiries_6m) : null,
        credit_history_months:     form.credit_history_months != null ? parseInt(form.credit_history_months) : null,
        monthly_avg_transactions:  parseInt(form.monthly_avg_transactions),
        monthly_avg_spend:         parseFloat(form.monthly_avg_spend),
        monthly_avg_balance:       parseFloat(form.monthly_avg_balance),
        salary_credit_regularity:  parseFloat(form.salary_credit_regularity),
        upi_bounce_rate:           parseFloat(form.upi_bounce_rate),
        months_of_txn_history:     parseInt(form.months_of_txn_history),
        bnpl_repayment_score:      form.bnpl_repayment_score != null ? parseFloat(form.bnpl_repayment_score) : null,
        min_balance_breach_count:  parseInt(form.min_balance_breach_count),
        bill_payments_on_time_pct: form.bill_payments_on_time_pct != null ? parseFloat(form.bill_payments_on_time_pct) : null,
      };
      const res = await scoreApplicant(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Scoring failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <div className="page-title">
            <div style={{ width: 24, height: 24, borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px var(--accent-glow)' }}>
              <img src="/CV_Logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            Evaluate Applicant
          </div>
          <div className="page-subtitle">Fill in applicant details and generate AI risk score</div>
        </div>
        <button className="btn btn-ghost" onClick={regen} type="button">
          <RefreshCw size={14} /> Auto-fill (Jittered)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FIELD_GROUPS.map(group => {
            const Icon = group.icon;
            return (
              <div key={group.title} className="card">
                <div className="form-section-title">
                  <Icon size={12} style={{ display: 'inline', marginRight: 6 }} />
                  {group.title}
                </div>

                <div className="grid-3" style={{ gap: 14 }}>
                  {group.fields.map(f => (
                    <div className="input-group" key={f.key}>
                      <label className="input-label">{f.label}</label>
                      {f.type === 'select' ? (
                        <select
                          className="input-field"
                          value={form[f.key] || ''}
                          onChange={e => set(f.key, e.target.value)}
                        >
                          {f.options.map(o => (
                            <option key={o} value={o}>{o.replace('_', ' ')}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input-field"
                          type={f.type}
                          value={form[f.key] ?? ''}
                          onChange={e => {
                            const v = e.target.value;
                            set(f.key, v === '' ? null : v);
                          }}
                          step={f.step}
                          min={f.min}
                          max={f.max}
                          required={!f.optional}
                          placeholder={f.optional ? 'Optional' : ''}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Boolean checkboxes */}
                {group.booleans && (
                  <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                    {group.booleans.map(b => (
                      <label key={b.key} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={!!form[b.key]}
                          onChange={e => set(b.key, e.target.checked)}
                        />
                        <span className="checkbox-label">{b.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 18px', marginTop: 16,
            background: 'rgba(255,59,78,0.08)',
            border: '1px solid rgba(255,59,78,0.2)',
            borderRadius: 'var(--radius-sm)',
            color: '#ff3b4e', fontSize: 13,
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-lg" onClick={regen}>
            <RefreshCw size={15} /> Regenerate Data
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Generating Score…
              </>
            ) : (
              <>
                <Zap size={16} /> Generate Score
              </>
            )}
          </button>
        </div>
      </form>

      {result && <ScoreModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}
