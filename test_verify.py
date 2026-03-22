import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_flow():
    # 1. Login
    print("Logging in...")
    login_res = requests.post(f"{BASE_URL}/api/v1/auth/token", data={
        "username": "ADMIN-001",
        "password": "password"
    })
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.text}")
        return
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test Low Risk (Vikram Rao)
    vikram = {
        "applicant_id": f"VIKRAM-{int(time.time())}",
        "full_name": "Vikram Rao",
        "email": "vikram@example.com",
        "age": 45,
        "employment_type": "salaried",
        "monthly_income": 210000.0,
        "loan_amount_requested": 3000000.0,
        "loan_tenure_months": 36,
        "existing_loans_count": 1,
        "total_emi_monthly": 18000.0,
        "bureau_credit_score": 831,
        "credit_enquiries_6m": 1,
        "credit_history_months": 120,
        "monthly_avg_transactions": 84,
        "monthly_avg_spend": 110000.0,
        "monthly_avg_balance": 480000.0,
        "salary_credit_regularity": 0.98,
        "bill_payments_on_time_pct": 0.99,
        "upi_bounce_rate": 0.0,
        "months_of_txn_history": 48,
        "bnpl_active": False,
        "insurance_premium_active": True,
        "min_balance_breach_count": 0,
        "bill_payments_on_time_pct": 0.99,
        "cashflow_volatility": 0.05
    }

    # 3. Test High Risk (Tariq Sheikh)
    tariq = {
        "applicant_id": f"TARIQ-{int(time.time())}",
        "full_name": "Tariq Sheikh",
        "email": "tariq@example.com",
        "age": 29,
        "employment_type": "unemployed",
        "monthly_income": 9500.0,
        "loan_amount_requested": 80000.0,
        "loan_tenure_months": 24,
        "existing_loans_count": 3,
        "total_emi_monthly": 7200.0,
        "bureau_credit_score": 368,
        "credit_enquiries_6m": 11,
        "credit_history_months": 6,
        "monthly_avg_transactions": 6,
        "monthly_avg_spend": 9200.0,
        "monthly_avg_balance": 600.0,
        "salary_credit_regularity": 0.3,
        "bill_payments_on_time_pct": 0.28,
        "upi_bounce_rate": 0.61,
        "months_of_txn_history": 2,
        "bnpl_active": True,
        "bnpl_repayment_score": 0.22,
        "insurance_premium_active": False,
        "min_balance_breach_count": 12,
        "cashflow_volatility": 0.78
    }

    print("\n--- Scoring Vikram Rao (Low Risk expected) ---")
    res1 = requests.post(f"{BASE_URL}/api/v1/score", json=vikram, headers=headers)
    print("Vikram Result:", res1.json().get("risk_score"), res1.json().get("risk_band"))

    print("\n--- Scoring Tariq Sheikh (High Risk expected) ---")
    res2 = requests.post(f"{BASE_URL}/api/v1/score", json=tariq, headers=headers)
    print("Tariq Result:", res2.json().get("risk_score"), res2.json().get("risk_band"))

if __name__ == "__main__":
    test_flow()
