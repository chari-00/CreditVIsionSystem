"""
CreditVision System — SQLAlchemy ORM Models
Team: Plasmon-X | Blueprints 2026
Maps to the 5-table PostgreSQL schema in sql/schema.sql
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime,
    ForeignKey, Index, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class LoginCredentials(Base):
    __tablename__ = "login_credentials"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(String(50),  unique=True, nullable=False, index=True)
    full_name       = Column(String(120), nullable=False)
    email           = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(Text,        nullable=False)
    role            = Column(String(20),  nullable=False)   # admin | lender
    is_active       = Column(Boolean,     nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    created_by      = Column(String(50),  ForeignKey("login_credentials.user_id",
                                                      ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'lender')", name="ck_role"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(String(50), ForeignKey("login_credentials.user_id",
                                               ondelete="CASCADE"), nullable=False)
    action     = Column(String(80), nullable=False)   # LOGIN | LOGOUT | SCORE | CREATE_USER | VIEW_APPLICANT
    detail     = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_activity_user",   "user_id"),
        Index("idx_activity_action", "action"),
        Index("idx_activity_time",   "created_at"),
    )


class DataMonitoring(Base):
    __tablename__ = "data_monitoring"

    id                 = Column(Integer, primary_key=True, index=True)
    snapshot_date      = Column(DateTime(timezone=True), server_default=func.now())
    total_scored       = Column(Integer, default=0)
    approved_count     = Column(Integer, default=0)
    under_review_count = Column(Integer, default=0)
    declined_count     = Column(Integer, default=0)
    avg_risk_score     = Column(Float)
    avg_pd             = Column(Float)
    cold_start_pct     = Column(Float)
    model_version      = Column(String(30), default="v1.0.0")
    notes              = Column(Text)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())


class ActiveApplication(Base):
    __tablename__ = "active_applications"

    id           = Column(Integer, primary_key=True, index=True)
    applicant_id = Column(String(50), unique=True, nullable=False)
    full_name    = Column(String(120), nullable=False)
    email        = Column(String(150))
    risk_score   = Column(Integer, nullable=False)    # 300–1000
    risk_band    = Column(String(20), nullable=False)  # CRITICAL|HIGH|MEDIUM|LOW|OPTIMAL
    pd_value     = Column(Float, nullable=False)
    decision     = Column(String(20), nullable=False)  # APPROVED|UNDER_REVIEW|DECLINED
    lender_id    = Column(String(50), ForeignKey("login_credentials.user_id",
                                                  ondelete="SET NULL"))
    approved_at  = Column(DateTime(timezone=True), server_default=func.now())
    loan_amount  = Column(Float)
    loan_tenure  = Column(Integer)
    notes        = Column(Text)

    __table_args__ = (
        Index("idx_active_decision", "decision"),
        Index("idx_active_lender",   "lender_id"),
    )


class ApplicationHistory(Base):
    __tablename__ = "application_history"

    id           = Column(Integer, primary_key=True, index=True)
    applicant_id = Column(String(50), nullable=False, index=True)
    full_name    = Column(String(120))
    email        = Column(String(150))

    # I. Entity Identification
    age             = Column(Integer)
    employment_type = Column(String(30))

    # II. Core Financials
    monthly_income        = Column(Float)
    loan_amount_requested = Column(Float)
    loan_tenure_months    = Column(Integer)
    total_emi_monthly     = Column(Float)
    bureau_credit_score   = Column(Integer)      # NULL = cold-start
    existing_loans_count  = Column(Integer)      # NULL = cold-start
    credit_enquiries_6m   = Column(Integer)      # NULL = cold-start
    credit_history_months = Column(Integer)      # NULL = cold-start

    # III. Transaction Analytics
    monthly_avg_transactions  = Column(Integer)
    monthly_avg_spend         = Column(Float)
    monthly_avg_balance       = Column(Float)
    salary_credit_regularity  = Column(Float)   # 0–1
    upi_bounce_rate           = Column(Float)   # 0–1
    months_of_txn_history     = Column(Integer)

    # IV. Alternative Risk Data
    bnpl_active              = Column(Boolean)
    bnpl_repayment_score     = Column(Float)    # NULL if no BNPL
    insurance_premium_active = Column(Boolean)
    min_balance_breach_count = Column(Integer)
    bill_payments_on_time_pct = Column(Float)   # 0–1

    # Scoring Output
    risk_score          = Column(Integer)       # 300–1000
    risk_band           = Column(String(20))
    pd_value            = Column(Float)
    decision            = Column(String(20))
    cold_start_flag     = Column(Boolean, default=False)
    bureau_available_flag = Column(Boolean, default=True)

    # SHAP Explainability
    shap_values      = Column(JSONB)
    key_risk_drivers = Column(JSONB)

    # Metadata
    is_email_sent = Column(Boolean, default=False)
    evaluated_by  = Column(String(50), ForeignKey("login_credentials.user_id",
                                                    ondelete="SET NULL"))
    evaluated_at  = Column(DateTime(timezone=True), server_default=func.now())
    model_version = Column(String(30), default="v1.0.0")

    __table_args__ = (
        Index("idx_history_applicant", "applicant_id"),
        Index("idx_history_evaluated", "evaluated_at"),
        Index("idx_history_decision",  "decision"),
        Index("idx_history_lender",    "evaluated_by"),
    )
