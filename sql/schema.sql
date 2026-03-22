-- ============================================================
-- CreditVision System — PostgreSQL Schema (CV_project)
-- Team: Plasmon-X | Blueprints 2026
-- ============================================================

CREATE DATABASE cv_project;
\c cv_project;

-- ============================================================
-- 1. LOGIN CREDENTIALS
-- Role-based access: admin | lender
-- ============================================================
CREATE TABLE IF NOT EXISTS login_credentials (
    id              SERIAL PRIMARY KEY,
    user_id         VARCHAR(50)  UNIQUE NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    hashed_password TEXT         NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'lender')),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(50)  REFERENCES login_credentials(user_id) ON DELETE SET NULL
);

-- Default admin seed (password: Admin@123 — change in production)
-- hashed via bcrypt
INSERT INTO login_credentials (user_id, full_name, email, hashed_password, role)
VALUES (
    'ADMIN-001',
    'System Administrator',
    'admin@creditvision.in',
    '$2b$12$KIXHuP4HQ5VpEXAMPLEHASH',   -- Replace with real bcrypt hash
    'admin'
) ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. ACTIVITY LOGS
-- Global audit trail for every user action
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id          SERIAL PRIMARY KEY,
    user_id     VARCHAR(50)  NOT NULL REFERENCES login_credentials(user_id) ON DELETE CASCADE,
    action      VARCHAR(80)  NOT NULL,   -- 'LOGIN' | 'LOGOUT' | 'SCORE' | 'CREATE_USER' | 'VIEW_APPLICANT'
    detail      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user   ON activity_logs(user_id);
CREATE INDEX idx_activity_action ON activity_logs(action);
CREATE INDEX idx_activity_time   ON activity_logs(created_at DESC);


-- ============================================================
-- 3. DATA MONITORING
-- Persistent ML model performance metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS data_monitoring (
    id                  SERIAL PRIMARY KEY,
    snapshot_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
    total_scored        INTEGER     NOT NULL DEFAULT 0,
    approved_count      INTEGER     NOT NULL DEFAULT 0,
    under_review_count  INTEGER     NOT NULL DEFAULT 0,
    declined_count      INTEGER     NOT NULL DEFAULT 0,
    avg_risk_score      FLOAT,
    avg_pd              FLOAT,
    cold_start_pct      FLOAT,       -- % of cold-start applicants
    model_version       VARCHAR(30) NOT NULL DEFAULT 'v1.0.0',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 4. ACTIVE APPLICATIONS
-- Approved credit applications registry
-- ============================================================
CREATE TABLE IF NOT EXISTS active_applications (
    id              SERIAL PRIMARY KEY,
    applicant_id    VARCHAR(50)  UNIQUE NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    email           VARCHAR(150),
    risk_score      INTEGER      NOT NULL,           -- 300–1000 scale
    risk_band       VARCHAR(20)  NOT NULL,           -- CRITICAL | HIGH | MEDIUM | LOW | OPTIMAL
    pd_value        FLOAT        NOT NULL,           -- 0–1 calibrated probability of default
    decision        VARCHAR(20)  NOT NULL,           -- APPROVED | UNDER_REVIEW | DECLINED
    lender_id       VARCHAR(50)  REFERENCES login_credentials(user_id),
    approved_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    loan_amount     FLOAT,
    loan_tenure     INTEGER,
    notes           TEXT
);

CREATE INDEX idx_active_decision ON active_applications(decision);
CREATE INDEX idx_active_lender   ON active_applications(lender_id);


-- ============================================================
-- 5. APPLICATION HISTORY
-- Full scoring history with all 22 input features + SHAP data
-- ============================================================
CREATE TABLE IF NOT EXISTS application_history (
    id                          SERIAL PRIMARY KEY,
    applicant_id                VARCHAR(50)  NOT NULL,
    full_name                   VARCHAR(120),
    email                       VARCHAR(150),

    -- I. Entity Identification
    age                         INTEGER,
    employment_type             VARCHAR(30),

    -- II. Core Financials
    monthly_income              FLOAT,
    loan_amount_requested       FLOAT,
    loan_tenure_months          INTEGER,
    total_emi_monthly           FLOAT,
    bureau_credit_score         INTEGER,        -- NULL = cold-start
    existing_loans_count        INTEGER,        -- NULL = cold-start
    credit_enquiries_6m         INTEGER,        -- NULL = cold-start
    credit_history_months       INTEGER,        -- NULL = cold-start

    -- III. Transaction Analytics
    monthly_avg_transactions    INTEGER,
    monthly_avg_spend           FLOAT,
    monthly_avg_balance         FLOAT,
    salary_credit_regularity    FLOAT,          -- 0–1
    upi_bounce_rate             FLOAT,          -- 0–1
    months_of_txn_history       INTEGER,

    -- IV. Alternative Risk Data
    bnpl_active                 BOOLEAN,
    bnpl_repayment_score        FLOAT,          -- NULL if no BNPL
    insurance_premium_active    BOOLEAN,
    min_balance_breach_count    INTEGER,
    bill_payments_on_time_pct   FLOAT,          -- 0–1 (derived/stored)

    -- Scoring Output
    risk_score                  INTEGER,        -- 300–1000
    risk_band                   VARCHAR(20),
    pd_value                    FLOAT,          -- 0–1
    decision                    VARCHAR(20),    -- APPROVED | UNDER_REVIEW | DECLINED
    is_email_sent               BOOLEAN      NOT NULL DEFAULT FALSE,
    cold_start_flag             BOOLEAN      DEFAULT FALSE,
    bureau_available_flag       BOOLEAN DEFAULT TRUE,

    -- SHAP Explainability (stored as JSONB)
    shap_values                 JSONB,
    key_risk_drivers            JSONB,

    -- Metadata
    evaluated_by                VARCHAR(50) REFERENCES login_credentials(user_id),
    evaluated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version               VARCHAR(30) DEFAULT 'v1.0.0'
);

CREATE INDEX idx_history_applicant  ON application_history(applicant_id);
CREATE INDEX idx_history_evaluated  ON application_history(evaluated_at DESC);
CREATE INDEX idx_history_decision   ON application_history(decision);
CREATE INDEX idx_history_lender     ON application_history(evaluated_by);
CREATE INDEX idx_history_shap       ON application_history USING GIN(shap_values);
