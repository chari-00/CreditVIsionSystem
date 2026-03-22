import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def test_workflow():
    print("--- 1. Testing Auth ---")
    auth_data = { "username": "ADMIN-001", "password": "password" }
    try:
        resp = requests.post(f"{BASE_URL}/auth/token", data=auth_data)
        resp.raise_for_status()
        token = resp.json()["access_token"]
        print("✓ Auth Successful")
    except Exception as e:
        print(f"✗ Auth Failed: {e}")
        return

    headers = { "Authorization": f"Bearer {token}" }

    print("\n--- 2. Testing Scoring & Risk Bands ---")
    # Test cases for boundaries
    test_cases = [
        {"score": 449, "expected": "CRITICAL"},
        {"score": 450, "expected": "HIGH"},
        {"score": 600, "expected": "MEDIUM"},
        {"score": 700, "expected": "LOW"},
        {"score": 850, "expected": "OPTIMAL"},
    ]
    
    # We can't directly inject score to /score, but we can check the helper function or test-data
    # For now, let's just score a dummy and see what happens.
    dummy_applicant = {
        "applicant_id": "TEST-VERIFY-001",
        "full_name": "Verification User",
        "email": "hailqwerty4321@gmail.com",
        "age": 30,
        "employment_type": "salaried",
        "monthly_income": 50000,
        "loan_amount_requested": 100000,
        "loan_tenure_months": 12,
        "monthly_avg_transactions": 20,
        "monthly_avg_spend": 10000,
        "monthly_avg_balance": 5000,
        "salary_credit_regularity": 1.0,
        "upi_bounce_rate": 0.05,
        "months_of_txn_history": 12,
        "bnpl_active": False,
        "insurance_premium_active": True,
        "min_balance_breach_count": 0
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/score", json=dummy_applicant, headers=headers)
        resp.raise_for_status()
        result = resp.json()
        hist_id = result["id"]
        print(f"✓ Scored Applicant: {result['applicant_id']} | Score: {result['risk_score']} | Band: {result['risk_band']}")
    except Exception as e:
        print(f"✗ Scoring Failed: {e}")
        return

    print("\n--- 3. Testing Email Idempotency ---")
    # Decision must be APPROVED or DECLINED to send mail. 
    # Let's ensure it is.
    if result["decision"] == "UNDER_REVIEW":
        print("Updating decision to APPROVED to test email...")
        requests.patch(f"{BASE_URL}/lender/history/{hist_id}/decision", json={"decision": "APPROVED"}, headers=headers)

    # First attempt
    try:
        resp = requests.post(f"{BASE_URL}/lender/history/{hist_id}/send-mail", headers=headers)
        print(f"First Attempt: {resp.status_code} - {resp.json().get('message') or resp.json().get('detail')}")
    except Exception as e:
        print(f"First Attempt Failed: {e}")

    # Second attempt
    try:
        resp = requests.post(f"{BASE_URL}/lender/history/{hist_id}/send-mail", headers=headers)
        print(f"Second Attempt (Should fail with 400): {resp.status_code} - {resp.json().get('detail')}")
        if resp.status_code == 400:
            print("✓ Email Idempotency Confirmed")
        else:
            print("✗ Email Idempotency failed (Should have returned 400)")
    except Exception as e:
        print(f"Second Attempt error: {e}")

if __name__ == "__main__":
    test_workflow()
