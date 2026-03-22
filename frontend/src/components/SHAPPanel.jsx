// CreditVision — SHAP Explainability Panel
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

const FEATURE_LABELS = {
  age: 'Age',
  employment_type_enc: 'Employment Type',
  monthly_income: 'Monthly Income',
  loan_amount_requested: 'Loan Requested',
  loan_tenure_months: 'Loan Tenure',
  existing_loans_count: 'Existing Loans',
  total_emi_monthly: 'Total EMI',
  bureau_credit_score: 'Bureau Score',
  credit_enquiries_6m: 'Credit Enquiries 6M',
  credit_history_months: 'Credit History',
  monthly_avg_transactions: 'Avg Transactions/Mo',
  monthly_avg_spend: 'Avg Monthly Spend',
  monthly_avg_balance: 'Avg Balance',
  salary_credit_regularity: 'Salary Regularity',
  upi_bounce_rate: 'UPI Bounce Rate',
  months_of_txn_history: 'Transaction History',
  bnpl_active: 'BNPL Active',
  bnpl_repayment_score: 'BNPL Repay Score',
  insurance_premium_active: 'Insurance Active',
  min_balance_breach_count: 'Min Bal Breaches',
  debt_to_income_ratio: 'Debt-to-Income',
  loan_to_income_ratio: 'Loan-to-Income',
  cold_start_flag: 'Cold Start',
  bureau_available_flag: 'Bureau Available',
  bill_payments_on_time_pct: 'Bill Payments On Time',
};

const getShapDescription = (feature, isRisk) => {
  const f = feature.toLowerCase();
  if (f.includes('upi_bounce')) return isRisk ? 'A high rate of failed UPI transactions strongly indicates underlying cash flow stress.' : 'Zero or minimal failed UPI transactions demonstrate strong daily financial discipline.';
  if (f.includes('bill_payments')) return isRisk ? 'A lower percentage of on-time bill payments suggests poor financial management.' : 'Consistent on-time bill payments reflect highly responsible credit behavior.';
  if (f.includes('salary')) return isRisk ? 'Irregular salary credits imply unstable income streams, elevating repayment risk.' : 'Highly regular salary credits provide strong assurance of stable repayment capacity.';
  if (f.includes('balance') || f.includes('spend')) return isRisk ? 'Lower average balances or high spend relative to income indicate limited financial buffers.' : 'Healthy average balances indicate strong financial buffers against unexpected expenses.';
  if (f.includes('bnpl')) return isRisk ? 'Poor Buy-Now-Pay-Later repayment history directly correlates with higher default probabilities.' : 'Strong Buy-Now-Pay-Later repayment history serves as a positive indicator of creditworthiness.';
  if (f.includes('bureau') || f.includes('credit_score')) return isRisk ? 'A lower traditional credit score is a primary indicator of historical credit risk.' : 'A strong traditional credit score provides a solid foundation of creditworthiness.';
  if (f.includes('enquiries')) return isRisk ? 'High recent credit enquiries suggest credit-hungry behavior and financial stress.' : 'Few recent credit enquiries indicate stable credit needs.';
  if (f.includes('loan_amount') || f.includes('emi') || f.includes('ratio')) return isRisk ? "A high requested loan amount or EMI burden stretches the applicant's capacity to repay." : "A manageable loan or EMI amount relative to income reduces the burden of repayment.";
  
  return isRisk 
    ? "This factor was mathematically significant in raising the system's risk assessment."
    : "This factor was mathematically significant in lowering the system's risk assessment.";
};

export default function SHAPPanel({ keyDrivers, shapValues, riskBand }) {
  // Prefer key_risk_drivers if available
  let drivers = keyDrivers?.drivers || shapValues?.values?.slice(0, 8).map((v, i) => ({
    feature: shapValues.features?.[i] || `Feature ${i}`,
    shap_value: v,
    direction: v > 0 ? 'RISK' : 'SAFE',
  })) || [];

  if (riskBand === 'OPTIMAL' || riskBand === 'LOW') {
    drivers = drivers.filter(d => d.direction === 'SAFE');
  } else if (riskBand === 'HIGH' || riskBand === 'CRITICAL') {
    drivers = drivers.filter(d => d.direction === 'RISK');
  } else if (riskBand === 'MEDIUM') {
    // For MEDIUM, we want exactly 2 positive and 2 negative factors if available
    const safe = drivers.filter(d => d.direction === 'SAFE').slice(0, 2);
    const risk = drivers.filter(d => d.direction === 'RISK').slice(0, 2);
    drivers = [...safe, ...risk].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value));
  }

  if (!drivers.length) return null;

  const maxAbs = Math.max(...drivers.map(d => Math.abs(d.shap_value)), 0.001);

  return (
    <div>
      <div className="section-title">
        <Info size={14} />
        Key Risk Drivers <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(SHAP)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
        {drivers.map((d, i) => {
          const isRisk = d.direction === 'RISK';
          const pct    = Math.round((Math.abs(d.shap_value) / maxAbs) * 100);
          const label  = FEATURE_LABELS[d.feature] || d.feature.replace(/_/g, ' ');
          const color  = isRisk ? '#ff3b4e' : '#02b946';
          const bg     = isRisk ? 'rgba(255,59,78,0.04)' : 'rgba(2,185,70,0.04)';
          const border = isRisk ? 'rgba(255,59,78,0.15)' : 'rgba(2,185,70,0.15)';
          const desc   = getShapDescription(d.feature, isRisk);

          return (
            <div
              key={i}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isRisk ? 'rgba(255,59,78,0.1)' : 'rgba(2,185,70,0.1)',
                color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {isRisk ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
                    {d.direction}
                  </span>
                </div>
                
                <div style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: 12
                }}>
                  {desc}
                </div>

                {/* Relative Impact Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.8s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {d.shap_value >= 0 ? '+' : ''}{d.shap_value.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
