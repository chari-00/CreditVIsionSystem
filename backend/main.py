"""
CreditVision System — FastAPI Backend Gateway
Team: Plasmon-X | Blueprints 2026
Full CRUD + ML Scoring + SHAP + Auth + Audit Trail
"""

import os, json, uuid, joblib
from dotenv import load_dotenv
load_dotenv()  # Load .env file before anything else reads os.getenv()

from datetime import datetime, timedelta
from typing import Optional, List

import numpy as np
import shap
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, func, desc
from sqlalchemy.orm import Session, sessionmaker
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression

from models_db import (
    Base, LoginCredentials, ActivityLog,
    DataMonitoring, ActiveApplication, ApplicationHistory
)

# ─────────────────────────────────────────────
# ENV & CONFIG
# ─────────────────────────────────────────────
# [NOTE] Using public PostgreSQL for CreditVision; fallback to SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/CreditVisionDB")
SECRET_KEY    = os.getenv("SECRET_KEY",   "CHANGE_THIS_IN_PRODUCTION_MIN_32_CHARS_SECRET")
ALGORITHM     = os.getenv("ALGORITHM",    "HS256")
TOKEN_EXPIRE  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
MODEL_VERSION = "v1.0.0"

# SMTP Settings
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
SMTP_ENABLED = all([SMTP_HOST, SMTP_USER, SMTP_PASS])

# ─────────────────────────────────────────────
# DB SETUP
# ─────────────────────────────────────────────
engine      = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─────────────────────────────────────────────
# AUTH SETUP
# ─────────────────────────────────────────────
# pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2  = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def hash_password(plain: str) -> str:
    """Hash a password using bcrypt directly."""
    pwd_bytes = plain.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a hash using bcrypt directly."""
    try:
        pwd_bytes = plain.encode('utf-8')
        hashed_bytes = hashed.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception as e:
        print(f"[CV] Password verification error: {e}")
        return False

def send_mail_task(to: str, name: str, subject: str, body: str, include_logo: bool = False):
    """
    Background task to send email. 
    Tries real SMTP if configured, else falls back to mock logging.
    """
    if SMTP_ENABLED:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            from email.mime.image import MIMEImage
            from email.utils import formataddr

            msg = MIMEMultipart()
            msg['Subject'] = subject
            msg['From'] = formataddr(("CreditVision", str(SMTP_FROM)))
            msg['To'] = formataddr((name, to))
            
            # Use HTML content for the body
            msg.attach(MIMEText(body, "html"))

            # Attach Logo if requested
            if include_logo:
                logo_path = os.path.join(os.path.dirname(__file__), "CV_CompleteLogo.png")
                if os.path.exists(logo_path):
                    with open(logo_path, 'rb') as f:
                        img = MIMEImage(f.read())
                        img.add_header('Content-ID', '<logo>')
                        img.add_header('Content-Disposition', 'inline', filename="CV_CompleteLogo.png")
                        msg.attach(img)

            with smtplib.SMTP(str(SMTP_HOST), SMTP_PORT) as server:
                server.starttls()
                server.login(str(SMTP_USER), str(SMTP_PASS))
                server.send_message(msg)
            
            print(f"[CV] SMTP: Successfully sent email to {to}")
            return
        except Exception as e:
            print(f"[CV] SMTP Error: {e}. Falling back to mock.")

    # FALLBACK: Professional Mock Logging
    print(f"\n{'='*70}")
    print(f"   [MOCK EMAIL SYSTEM - {'SMTP OFFLINE' if not SMTP_ENABLED else 'SMTP FAILED'}]")
    print(f"   To:      {to} ({name})")
    print(f"   Subject: {subject}")
    print(f"   Date:    {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   {'-'*70}")
    print(f"   {body}")
    if include_logo:
        print(f"   [ATTACHMENT] CV_CompleteLogo.png (Official Branding Embedded)")
    print(f"{'='*70}\n")

def send_mock_email(to: str, name: str, subject: str, body: str, include_logo: bool = False):
    """Public wrapper (deprecated name, now uses send_mail_task logic)"""
    send_mail_task(to, name, subject, body, include_logo)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)):
    err = HTTPException(status_code=401, detail="Invalid or expired token",
                        headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid: str = payload.get("sub")
        if uid is None:
            raise err
    except JWTError:
        raise err
    user = db.query(LoginCredentials).filter_by(user_id=uid, is_active=True).first()
    if not user:
        raise err
    return user

def require_role(*roles):
    def checker(user: LoginCredentials = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker

# ─────────────────────────────────────────────
# ML MODEL LOADING
# ─────────────────────────────────────────────
# Place ALL of these files into backend/models/ and they load automatically.
#
# Your exact files (from models/ folder):
#   calibrated_lr.joblib          ← PRIMARY model used for scoring
#   isotonic_calibrator.joblib    ← v1 isotonic calibrator
#   isotonic_calibrator_v2.joblib ← v2 isotonic calibrator (preferred)
#   lr_model.joblib               ← raw logistic regression (base, uncalibrated)
#   model_features.joblib         ← feature column names used during training
#   model_metadata.json           ← metadata (threshold, version, etc.)
#   optimal_threshold.joblib      ← decision threshold for classification
#   random_state.joblib           ← random state (informational only)
#   scaler.joblib                 ← StandardScaler applied before inference
#   shap_explainer.joblib         ← pre-built SHAP explainer (fastest)
# ─────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

# Global model objects
_model             = None   # calibrated_lr.joblib  — primary scorer
_lr_model          = None   # lr_model.joblib        — raw LR fallback
_calibrator        = None   # isotonic_calibrator_v2.joblib (preferred) or v1
_scaler            = None   # scaler.joblib
_explainer         = None   # shap_explainer.joblib (pre-built) or built at runtime
_optimal_threshold = 0.5    # optimal_threshold.joblib
_feature_columns   = None   # model_features.joblib  — authoritative feature list
_model_metadata    = {}     # model_metadata.json
_loaded_files      = []     # which files were successfully loaded (for /health)

# Fallback feature order if model_features.joblib is absent
FEATURE_COLUMNS_DEFAULT = [
    "age", "employment_type_enc", "monthly_income", "loan_amount_requested",
    "loan_tenure_months", "existing_loans_count", "total_emi_monthly",
    "bureau_credit_score", "credit_enquiries_6m", "credit_history_months",
    "monthly_avg_transactions", "monthly_avg_spend", "monthly_avg_balance",
    "salary_credit_regularity", "upi_bounce_rate", "months_of_txn_history",
    "bnpl_active", "bnpl_repayment_score", "insurance_premium_active",
    "min_balance_breach_count", "debt_to_income_ratio", "loan_to_income_ratio",
    "cold_start_flag", "bureau_available_flag"
]


def _load_file(filename: str):
    """Load a .joblib file from models/. Returns (object, True) or (None, False)."""
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.isfile(path):
        return None, False
    try:
        obj = joblib.load(path)
        print(f"[CV]   ✓ {filename}")
        return obj, True
    except Exception as e:
        print(f"[CV]   ✗ {filename} — {e}")
        return None, False


def _load_json(filename: str):
    """Load a .json file from models/. Returns (dict, True) or ({}, False)."""
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.isfile(path):
        return {}, False
    try:
        with open(path) as f:
            obj = json.load(f)
        print(f"[CV]   ✓ {filename}")
        return obj, True
    except Exception as e:
        print(f"[CV]   ✗ {filename} — {e}")
        return {}, False


def load_model():
    global _model, _lr_model, _calibrator, _scaler, _explainer
    global _optimal_threshold, _feature_columns, _model_metadata, _loaded_files

    print("[CV] ── Loading models from backend/models/ ──")

    # 1. Feature column list — load first so everything else aligns
    feats, ok = _load_file("model_features.joblib")
    if ok:
        _feature_columns = list(feats)
        _loaded_files.append("model_features.joblib")
    else:
        _feature_columns = FEATURE_COLUMNS_DEFAULT
        print("[CV]   ! model_features.joblib not found — using default feature order")

    # 2. Model metadata (threshold, version info, etc.)
    meta, ok = _load_json("model_metadata.json")
    if ok:
        _model_metadata = meta
        _loaded_files.append("model_metadata.json")

    # 3. Optimal decision threshold
    thresh, ok = _load_file("optimal_threshold.joblib")
    if ok:
        _optimal_threshold = float(thresh)
        _loaded_files.append("optimal_threshold.joblib")
        print(f"[CV]   → Decision threshold: {_optimal_threshold:.4f}")

    # 4. Scaler (must be applied BEFORE model inference)
    sc, ok = _load_file("scaler.joblib")
    if ok:
        _scaler = sc
        _loaded_files.append("scaler.joblib")

    # 5. Primary model — calibrated_lr.joblib preferred
    cal_lr, ok = _load_file("calibrated_lr.joblib")
    if ok:
        _model = cal_lr
        _loaded_files.append("calibrated_lr.joblib")
    else:
        # Fall back to raw LR model
        lr, ok2 = _load_file("lr_model.joblib")
        if ok2:
            _model = lr
            _loaded_files.append("lr_model.joblib")
            print("[CV]   ! calibrated_lr.joblib not found — using lr_model.joblib")

    # 6. Raw LR model (keep separately for reference, even if calibrated was loaded)
    lr_raw, ok = _load_file("lr_model.joblib")
    if ok and "lr_model.joblib" not in _loaded_files:
        _lr_model = lr_raw
        _loaded_files.append("lr_model.joblib")

    # 7. Isotonic calibrator — v2 preferred over v1
    cal_v2, ok = _load_file("isotonic_calibrator_v2.joblib")
    if ok:
        _calibrator = cal_v2
        _loaded_files.append("isotonic_calibrator_v2.joblib")
    else:
        cal_v1, ok2 = _load_file("isotonic_calibrator.joblib")
        if ok2:
            _calibrator = cal_v1
            _loaded_files.append("isotonic_calibrator.joblib")
            print("[CV]   ! isotonic_calibrator_v2 not found — using v1")

    # 8. Pre-built SHAP explainer — fastest option, use if present
    shap_exp, ok = _load_file("shap_explainer.joblib")
    if ok:
        _explainer = shap_exp
        _loaded_files.append("shap_explainer.joblib")
    elif _model is not None:
        # Build SHAP explainer at runtime from the loaded model
        print("[CV]   Building SHAP explainer at runtime…")
        try:
            # LinearExplainer works for LR and CalibratedClassifierCV(LR)
            _explainer = shap.LinearExplainer(
                _model,
                masker=shap.maskers.Independent(
                    np.zeros((1, len(_feature_columns)))
                )
            )
            print("[CV]   ✓ SHAP LinearExplainer built")
        except Exception:
            try:
                bg = np.zeros((1, len(_feature_columns)))
                _explainer = shap.KernelExplainer(_model.predict_proba, bg)
                print("[CV]   ✓ SHAP KernelExplainer built (fallback)")
            except Exception as e:
                print(f"[CV]   ✗ Could not build SHAP explainer: {e}")

    # 9. random_state.joblib — informational only, no action needed
    _, ok = _load_file("random_state.joblib")
    if ok:
        _loaded_files.append("random_state.joblib")

    # ── Summary ──
    if _model is not None:
        print(f"[CV] ✓ Pipeline ready — {len(_loaded_files)} files loaded")
        print(f"[CV]   Files: {', '.join(_loaded_files)}")
    else:
        print("[CV] ✗ No model loaded — using deterministic fallback for demo")


def score_applicant(features: np.ndarray):
    """
    Full inference pipeline:
      raw features → scaler → calibrated_lr → [isotonic calibrator] → PD
      PD → risk_score (300–1000) + SHAP values

    Returns: (pd_value: float, risk_score: int, shap_vals: list)
    """
    n_feats = len(_feature_columns) if _feature_columns else len(FEATURE_COLUMNS_DEFAULT)

    # ── Fallback: no model loaded ──
    if _model is None:
        seed      = float(features[0][2]) % 1
        pd_val    = round(max(0.01, min(0.99, 0.35 + (seed - 0.5) * 0.6)), 4)
        shap_vals = [round((i - 12) * 0.01 * pd_val, 4) for i in range(n_feats)]
        risk_score = max(300, min(1000, int(1000 - pd_val * 700)))
        return pd_val, risk_score, shap_vals

    # ── Step 1: Scale features ──
    X = _scaler.transform(features) if _scaler is not None else features

    # ── Step 2: Base model PD ──
    pd_val = float(_model.predict_proba(X)[0][1])

    # ── Step 3: Apply isotonic calibrator on top (if separate from model) ──
    # Only apply if _model is the raw lr_model (not calibrated_lr which is already calibrated)
    if _calibrator is not None and "calibrated_lr.joblib" not in _loaded_files:
        try:
            pd_val = float(_calibrator.predict([[pd_val]])[0])
        except Exception:
            try:
                pd_val = float(_calibrator.predict(X)[0])
            except Exception:
                pass

    pd_val = max(0.0001, min(0.9999, pd_val))

    # ── Step 4: SHAP values ──
    shap_vals = []
    if _explainer is not None:
        try:
            sv = _explainer.shap_values(X)
            if isinstance(sv, list) and len(sv) == 2:
                sv = sv[1]   # binary classification — take class-1
            shap_vals = sv[0].tolist() if hasattr(sv[0], "tolist") else list(sv[0])
        except Exception as e:
            print(f"[CV] SHAP warning: {e}")

    # ── Step 5: Map PD → 300–1000 risk score ──
    risk_score = max(300, min(1000, int(1000 - pd_val * 700)))
    print(f"[CV DEBUG] Inference: PD={pd_val:.6f} -> RiskScore={risk_score}")
    return pd_val, risk_score, shap_vals

def pd_to_band(score: int) -> str:
    if score >= 850:  return "OPTIMAL"
    if score >= 700:  return "LOW"
    if score >= 600:  return "MEDIUM"
    if score >= 450:  return "HIGH"
    return "CRITICAL"

def score_to_decision(score: int, pd_val: float = None) -> str:
    # ALWAYS use score bands for consistency with risk_band
    if score >= 850: return "APPROVED"      # OPTIMAL
    if score >= 450: return "UNDER_REVIEW"  # LOW, MEDIUM, HIGH
    return "DECLINED"                       # CRITICAL

# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────
class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    user_id:      str
    full_name:    str

class UserCreate(BaseModel):
    user_id:   str
    full_name: str
    email:     EmailStr
    password:  str
    role:      str = Field(..., pattern="^(admin|lender)$")

class UserOut(BaseModel):
    user_id:    str
    full_name:  str
    email:      str
    role:       str
    is_active:  bool
    created_at: datetime
    class Config: from_attributes = True

class ScoreRequest(BaseModel):
    # Entity
    applicant_id:  str
    full_name:     str
    email:         EmailStr
    age:           int = Field(..., ge=18, le=80)
    employment_type: str
    # Core Financials
    monthly_income:        float = Field(..., gt=0)
    loan_amount_requested: float = Field(..., gt=0)
    loan_tenure_months:    int   = Field(..., ge=3, le=360)
    total_emi_monthly:     Optional[float]  = None
    bureau_credit_score:   Optional[int]    = None
    existing_loans_count:  Optional[int]    = None
    credit_enquiries_6m:   Optional[int]    = None
    credit_history_months: Optional[int]    = None
    # Transaction Analytics
    monthly_avg_transactions: int   = Field(..., ge=0)
    monthly_avg_spend:        float = Field(..., ge=0)
    monthly_avg_balance:      float = Field(..., ge=0)
    salary_credit_regularity: float = Field(..., ge=0.0, le=1.0)
    upi_bounce_rate:          float = Field(..., ge=0.0, le=1.0)
    months_of_txn_history:    int   = Field(..., ge=1)
    # Alternative
    bnpl_active:             bool
    bnpl_repayment_score:    Optional[float] = None
    insurance_premium_active: bool
    min_balance_breach_count: int   = Field(..., ge=0)
    bill_payments_on_time_pct: Optional[float] = Field(None, ge=0.0, le=1.0)
    cashflow_volatility: Optional[float] = Field(None, ge=0.0, le=1.0)

class ScoreOut(BaseModel):
    id:              int
    applicant_id:    str
    risk_score:      int
    risk_band:       str
    pd_value:        float
    decision:        str
    cold_start_flag: bool
    key_risk_drivers: list
    evaluated_at:    datetime

class ActivityOut(BaseModel):
    id:         int
    user_id:    str
    action:     str
    detail:     Optional[str]
    created_at: datetime
    class Config: from_attributes = True

class ApplicantDetail(BaseModel):
    id:           int
    applicant_id: str
    full_name:    Optional[str]
    email:        Optional[str]
    age:          Optional[int]
    employment_type: Optional[str]
    monthly_income: Optional[float]
    loan_amount_requested: Optional[float]
    loan_tenure_months: Optional[int]
    risk_score:   Optional[int]
    risk_band:    Optional[str]
    pd_value:     Optional[float]
    decision:     Optional[str]
    shap_values:  Optional[dict]
    key_risk_drivers: Optional[dict]
    evaluated_at: datetime
    class Config: from_attributes = True

# ─────────────────────────────────────────────
# APP INIT
# ─────────────────────────────────────────────
app = FastAPI(title="CreditVision API", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    load_model()
    db = SessionLocal()
    try:
        # 1. Seed Admin
        if not db.query(LoginCredentials).filter_by(user_id="ADMIN-001").first():
            admin = LoginCredentials(
                user_id="ADMIN-001",
                full_name="System Administrator",
                email="admin@creditvision.in",
                hashed_password=hash_password("password"),
                role="admin"
            )
            db.add(admin)
            print("[CV] Admin seeded → ADMIN-001 / password")

        # 3. Seed SYSTEM User (for automated logging)
        if not db.query(LoginCredentials).filter_by(user_id="SYSTEM").first():
            system_user = LoginCredentials(
                user_id="SYSTEM",
                full_name="CreditVision System",
                email="system@creditvision.ai",
                hashed_password=hash_password("SYSTEM_SERVICE_KEY_" + os.urandom(8).hex()),
                role="admin",
                is_active=False # Not for login
            )
            db.add(system_user)
            print("[CV] System user seeded → SYSTEM")

        db.commit()
    finally:
        db.close()

def log_action(db: Session, user_id: str, action: str, detail: str = None):
    db.add(ActivityLog(user_id=user_id, action=action, detail=detail))
    db.commit()

# ─────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────
@app.post("/api/v1/auth/token", response_model=TokenOut, tags=["Auth"])
async def login(
    form:     OAuth2PasswordRequestForm = Depends(),
    db:       Session = Depends(get_db)
):
    user = db.query(LoginCredentials).filter_by(user_id=form.username, is_active=True).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user.user_id, "role": user.role})
    log_action(db, user.user_id, "LOGIN", detail="Login")
    return TokenOut(access_token=token, role=user.role,
                    user_id=user.user_id, full_name=user.full_name)

@app.post("/api/v1/auth/logout", tags=["Auth"])
async def logout(
    user:    LoginCredentials = Depends(get_current_user),
    db:      Session = Depends(get_db)
):
    log_action(db, user.user_id, "LOGOUT")
    return {"message": "Logged out successfully"}

# ─────────────────────────────────────────────
# ADMIN — USER MANAGEMENT
# ─────────────────────────────────────────────
@app.get("/api/v1/admin/users", response_model=List[UserOut], tags=["Admin"])
async def list_users(
    user: LoginCredentials = Depends(require_role("admin")),
    db:   Session = Depends(get_db)
):
    return db.query(LoginCredentials).order_by(LoginCredentials.created_at.desc()).all()

@app.post("/api/v1/admin/users", response_model=UserOut, tags=["Admin"])
async def create_user(
    payload: UserCreate,
    user:    LoginCredentials = Depends(require_role("admin")),
    db:      Session = Depends(get_db)
):
    if db.query(LoginCredentials).filter_by(user_id=payload.user_id).first():
        raise HTTPException(status_code=409, detail="user_id already exists")
    if db.query(LoginCredentials).filter_by(email=payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    new_user = LoginCredentials(
        user_id=payload.user_id,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        created_by=user.user_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    log_action(db, user.user_id, "CREATE_USER",
               detail=f"Created {payload.role} '{payload.user_id}'")
    return new_user

@app.delete("/api/v1/admin/users/{uid}", tags=["Admin"])
async def delete_user(
    uid:  str,
    user: LoginCredentials = Depends(require_role("admin")),
    db:   Session = Depends(get_db)
):
    if uid == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account.")
    
    target = db.query(LoginCredentials).filter_by(user_id=uid).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(target)
    db.commit()
    log_action(db, user.user_id, "DELETE_USER", detail=f"Deleted user '{uid}'")
    return {"message": f"User {uid} deleted successfully"}

# ─────────────────────────────────────────────
# ADMIN — DASHBOARD STATS
# ─────────────────────────────────────────────
@app.get("/api/v1/admin/stats", tags=["Admin"])
async def admin_stats(
    user: LoginCredentials = Depends(require_role("admin")),
    db:   Session = Depends(get_db)
):
    total     = db.query(func.count(ApplicationHistory.id)).scalar() or 0
    approved  = db.query(func.count(ApplicationHistory.id)).filter_by(decision="APPROVED").scalar() or 0
    review    = db.query(func.count(ApplicationHistory.id)).filter_by(decision="UNDER_REVIEW").scalar() or 0
    declined  = db.query(func.count(ApplicationHistory.id)).filter_by(decision="DECLINED").scalar() or 0
    avg_score = db.query(func.avg(ApplicationHistory.risk_score)).scalar()
    avg_pd    = db.query(func.avg(ApplicationHistory.pd_value)).scalar()
    cold_start= db.query(func.count(ApplicationHistory.id)).filter_by(cold_start_flag=True).scalar() or 0
    users     = db.query(func.count(LoginCredentials.id)).scalar() or 0

    # Sync to DataMonitoring table
    dm = db.query(DataMonitoring).order_by(desc(DataMonitoring.snapshot_date)).first()
    if not dm or dm.total_scored != total:
        new_dm = DataMonitoring(
            total_scored=total,
            approved_count=approved,
            under_review_count=review,
            declined_count=declined,
            avg_risk_score=avg_score,
            avg_pd=avg_pd,
            cold_start_pct=(cold_start / max(1, total)) * 100.0,
            model_version=MODEL_VERSION
        )
        db.add(new_dm)
        db.commit()

    return {
        "total_scored": total,
        "approved": approved,
        "under_review": review,
        "declined": declined,
        "avg_risk_score": round(avg_score, 1) if avg_score else 0,
        "avg_pd": round(avg_pd, 4) if avg_pd else 0,
        "cold_start_count": cold_start,
        "total_users": users,
        "model_version": MODEL_VERSION
    }

# ─────────────────────────────────────────────
# ADMIN — ACTIVITY LOGS
# ─────────────────────────────────────────────
@app.get("/api/v1/admin/activity", response_model=List[ActivityOut], tags=["Admin"])
async def activity_logs(
    limit: int = 100,
    user:  LoginCredentials = Depends(require_role("admin")),
    db:    Session = Depends(get_db)
):
    return (
        db.query(ActivityLog)
        .order_by(desc(ActivityLog.created_at))
        .limit(limit)
        .all()
    )

# ─────────────────────────────────────────────
# ADMIN — DATA MONITORING (all applicants)
# ─────────────────────────────────────────────
@app.get("/api/v1/admin/applicants", tags=["Admin"])
async def all_applicants(
    limit: int = 200,
    user:  LoginCredentials = Depends(require_role("admin")),
    db:    Session = Depends(get_db)
):
    records = (
        db.query(ApplicationHistory)
        .order_by(desc(ApplicationHistory.evaluated_at))
        .limit(limit)
        .all()
    )
    return [_serialize_history(r) for r in records]

@app.get("/api/v1/admin/applicants/{applicant_id}", tags=["Admin"])
async def applicant_detail_admin(
    applicant_id: str,
    user: LoginCredentials = Depends(require_role("admin")),
    db:   Session = Depends(get_db)
):
    rec = db.query(ApplicationHistory).filter_by(applicant_id=applicant_id).order_by(
        desc(ApplicationHistory.evaluated_at)).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Applicant not found")
    log_action(db, user.user_id, "VIEW_APPLICANT", detail=f"Viewed {applicant_id}")
    return _serialize_history(rec)

# ─────────────────────────────────────────────
# EVALUATION HELPER ENDPOINTS
# ─────────────────────────────────────────────
@app.get("/api/v1/test-data", tags=["Evaluation"])
async def get_test_data():
    """Return content of test_inputs.json for UI auto-fill."""
    path = os.path.join(os.path.dirname(__file__), "test_inputs.json")
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)

@app.get("/api/v1/applicants/check/{applicant_id}", tags=["Evaluation"])
async def check_applicant(
    applicant_id: str,
    db: Session = Depends(get_db)
):
    """Check if an applicant ID already exists in the history."""
    exists = db.query(ApplicationHistory).filter_by(applicant_id=applicant_id).first() is not None
    return {"exists": exists}

# ─────────────────────────────────────────────
# LENDER — SCORING ENGINE
# ─────────────────────────────────────────────
@app.post("/api/v1/score", response_model=ScoreOut, tags=["Lender"])
async def score(
    payload:    ScoreRequest,
    background: BackgroundTasks,
    user:       LoginCredentials = Depends(require_role("lender", "admin")),
    db:         Session = Depends(get_db)
):
    cold_start = not any([payload.bureau_credit_score, payload.credit_history_months,
                          payload.existing_loans_count])
    bureau_avail = bool(payload.bureau_credit_score)

    # Derived Features
    dti = (payload.total_emi_monthly or 0) / max(payload.monthly_income, 1)
    lti = payload.loan_amount_requested / max(payload.monthly_income, 1)
    
    # Heuristic derived scores (normalized roughly 0-1)
    # Income Stability: uses regularity + employment type bonus
    emp_bonus = 0.2 if payload.employment_type.lower() == "salaried" else 0.0
    income_stability = min(1.0, (payload.salary_credit_regularity or 0) + emp_bonus)
    # Repayment Behavior: uses bill payments vs upi bounces
    repayment_score = max(0.0, (payload.bill_payments_on_time_pct or 0.8) - (payload.upi_bounce_rate or 0))

    # Map employment types to 3-class one-hot (salaried, self_employed, unemployed)
    # Based on model_features.joblib dump
    emp_salaried = 1 if payload.employment_type.lower() == "salaried" else 0
    emp_self_employed = 1 if payload.employment_type.lower() == "self_employed" else 0
    emp_unemployed = 1 if payload.employment_type.lower() in ["unemployed", "others", "gig"] else 0

    # Build 30-feature vector in EXACT order of model_features.joblib
    feat_vec = np.array([[
        payload.age,                              # 0
        payload.monthly_income,                   # 1
        payload.loan_amount_requested,            # 2
        payload.loan_tenure_months,               # 3
        payload.existing_loans_count or 0,         # 4
        payload.total_emi_monthly or 0,            # 5
        payload.bureau_credit_score or 0,          # 6
        payload.credit_enquiries_6m or 0,          # 7
        payload.credit_history_months or 0,        # 8
        payload.monthly_avg_transactions,          # 9
        payload.monthly_avg_spend,                 # 10
        payload.monthly_avg_balance,               # 11
        payload.salary_credit_regularity,          # 12
        payload.bill_payments_on_time_pct or 0.8,  # 13
        payload.upi_bounce_rate,                   # 14
        int(payload.bnpl_active),                  # 15
        payload.bnpl_repayment_score or 0.5,       # 16
        payload.months_of_txn_history,             # 17
        int(payload.insurance_premium_active),     # 18
        payload.min_balance_breach_count,          # 19
        dti,                                       # 20
        lti,                                       # 21
        income_stability,                          # 22
        repayment_score,                           # 23
        payload.cashflow_volatility or 0.2,        # 24
        int(bureau_avail),                         # 25
        int(cold_start),                           # 26
        emp_salaried,                              # 27
        emp_self_employed,                         # 28
        emp_unemployed                             # 29
    ]])

    # Use authoritative feature list from model_features.joblib if loaded
    active_features = _feature_columns if _feature_columns else FEATURE_COLUMNS_DEFAULT

    pd_val, risk_score, shap_vals = score_applicant(feat_vec)
    risk_band = pd_to_band(risk_score)
    decision  = score_to_decision(risk_score, pd_val)

    # Build SHAP driver summary
    drivers = []
    for i, (col, val) in enumerate(zip(active_features, shap_vals)):
        drivers.append({
            "feature": col,
            "shap_value": round(val, 4),
            "direction": "RISK" if val > 0 else "SAFE"
        })
    drivers.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    top_drivers = drivers[:6]

    now = datetime.utcnow()

    # Persist to application_history
    hist = ApplicationHistory(
        applicant_id=payload.applicant_id,
        full_name=payload.full_name,
        email=payload.email,
        age=payload.age,
        employment_type=payload.employment_type,
        monthly_income=payload.monthly_income,
        loan_amount_requested=payload.loan_amount_requested,
        loan_tenure_months=payload.loan_tenure_months,
        total_emi_monthly=payload.total_emi_monthly,
        bureau_credit_score=payload.bureau_credit_score,
        existing_loans_count=payload.existing_loans_count,
        credit_enquiries_6m=payload.credit_enquiries_6m,
        credit_history_months=payload.credit_history_months,
        monthly_avg_transactions=payload.monthly_avg_transactions,
        monthly_avg_spend=payload.monthly_avg_spend,
        monthly_avg_balance=payload.monthly_avg_balance,
        salary_credit_regularity=payload.salary_credit_regularity,
        upi_bounce_rate=payload.upi_bounce_rate,
        months_of_txn_history=payload.months_of_txn_history,
        bnpl_active=payload.bnpl_active,
        bnpl_repayment_score=payload.bnpl_repayment_score,
        insurance_premium_active=payload.insurance_premium_active,
        min_balance_breach_count=payload.min_balance_breach_count,
        bill_payments_on_time_pct=payload.bill_payments_on_time_pct,
        risk_score=risk_score,
        risk_band=risk_band,
        pd_value=pd_val,
        decision=decision,
        cold_start_flag=cold_start,
        bureau_available_flag=bureau_avail,
        shap_values={"values": shap_vals.tolist() if hasattr(shap_vals, 'tolist') else shap_vals, 
                     "features": active_features},
        key_risk_drivers={"drivers": top_drivers},
        evaluated_by=user.user_id,
        evaluated_at=now,
        model_version=MODEL_VERSION
    )
    db.add(hist)
    db.flush() # Populate hist.id

    # 1. Access Notification Email
    html_access = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="cid:logo" alt="CreditVision Logo" style="width: 150px; height: auto;">
            </div>
            <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Data Access Notification</h2>
            <p>Dear <strong>{payload.full_name}</strong>,</p>
            <p>Your financial details have been accessed for a credit assessment on the <strong>CreditVision Platform</strong>.</p>
            <p>This is a standard notification to ensure transparency across your data profile.</p>
            <br>
            <p>Regards,<br><strong>Plasmon-X Team</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 11px; color: #999; text-align: center;">Reference: {payload.applicant_id} | Security: {MODEL_VERSION}</p>
        </div>
    </body>
    </html>
    """
    send_mock_email(
        to=payload.email,
        name=payload.full_name,
        subject="Notification: Data Access on CreditVision Platform",
        body=html_access,
        include_logo=True
    )
    
    # Note: Decision Notification Email is NO LONGER sent automatically upon scoring. 
    # Must explicitly hit the /send-mail endpoint.

    # 3. Activity Logs
    log_action(db, "SYSTEM", "NEW_APPLICANT", 
               detail=f"New applicant {payload.applicant_id} ({payload.full_name}) created.")
    log_action(db, user.user_id, "EVALUATE_SCORE", 
               detail=f"Lender evaluated {payload.applicant_id} → {risk_band}")

    # Update active_applications if APPROVED
    if decision == "APPROVED":
        existing = db.query(ActiveApplication).filter_by(
            applicant_id=payload.applicant_id).first()
        if existing:
            existing.risk_score = risk_score
            existing.risk_band  = risk_band
            existing.pd_value   = pd_val
            existing.decision   = decision
        else:
            db.add(ActiveApplication(
                applicant_id=payload.applicant_id,
                full_name=payload.full_name,
                email=payload.email,
                risk_score=risk_score,
                risk_band=risk_band,
                pd_value=pd_val,
                decision=decision,
                lender_id=user.user_id,
                loan_amount=payload.loan_amount_requested,
                loan_tenure=payload.loan_tenure_months
            ))

    db.commit()
    log_action(db, user.user_id, "SCORE",
               detail=f"Scored {payload.applicant_id} → {risk_score} ({decision})")

    return ScoreOut(
        id=hist.id,
        applicant_id=payload.applicant_id,
        risk_score=risk_score,
        risk_band=risk_band,
        pd_value=pd_val,
        decision=decision,
        cold_start_flag=cold_start,
        key_risk_drivers=top_drivers,
        evaluated_at=now
    )

class DecisionUpdate(BaseModel):
    decision: str = Field(..., pattern="^(APPROVED|DECLINED)$")
    risk_band: Optional[str] = None

@app.patch("/api/v1/lender/history/{history_id}/decision", tags=["Lender"])
async def update_decision(
    history_id: int,
    payload:    DecisionUpdate,
    user:       LoginCredentials = Depends(require_role("lender", "admin")),
    db:         Session = Depends(get_db)
):
    rec = db.query(ApplicationHistory).filter_by(id=history_id, evaluated_by=user.user_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Application record not found")
    
    if rec.decision != "UNDER_REVIEW":
        raise HTTPException(status_code=400, detail="Only applications 'UNDER_REVIEW' can be overridden.")

    old_dec = rec.decision
    rec.decision = payload.decision
    if payload.risk_band:
        rec.risk_band = payload.risk_band
    
    # Also update active_applications if it exists
    active = db.query(ActiveApplication).filter_by(applicant_id=rec.applicant_id).first()
    if payload.decision == "APPROVED":
        if active:
            active.decision = "APPROVED"
            if payload.risk_band: active.risk_band = payload.risk_band
        else:
            db.add(ActiveApplication(
                applicant_id=rec.applicant_id,
                full_name=rec.full_name,
                email=rec.email,
                risk_score=rec.risk_score,
                risk_band=rec.risk_band,
                pd_value=rec.pd_value,
                decision="APPROVED",
                lender_id=user.user_id,
                loan_amount=rec.loan_amount_requested,
                loan_tenure=rec.loan_tenure_months
            ))
    elif payload.decision == "DECLINED" and active:
        db.delete(active)

    log_action(db, user.user_id, "UPDATE_DECISION", 
               detail=f"Updated {rec.applicant_id} from {old_dec} to {payload.decision}")
    db.commit()
    return {"message": f"Decision updated to {payload.decision}", "new_decision": payload.decision}

@app.post("/api/v1/lender/history/{history_id_val}/send-mail", tags=["Lender"])
async def send_result_mail(
    history_id_val: str,
    background_tasks: BackgroundTasks,
    user:       LoginCredentials = Depends(require_role("lender", "admin")),
    db:         Session = Depends(get_db)
):
    try:
        print(f"[CV] POST /api/v1/lender/history/{history_id_val}/send-mail - Request by {user.user_id}")
        
        # Robust lookup: try numeric ID first, then applicant_id string
        rec = None
        if history_id_val.isdigit():
            rec = db.query(ApplicationHistory).filter_by(id=int(history_id_val)).first()
        
        if not rec:
            rec = db.query(ApplicationHistory).filter_by(applicant_id=history_id_val).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Application record not found")
        
        if rec.is_email_sent:
            raise HTTPException(status_code=400, detail="An email has already been sent for this application.")

        if rec.decision not in ["APPROVED", "DECLINED"]:
            raise HTTPException(status_code=400, detail="Emails can only be sent for finalized decisions (Approved/Declined).")

        driver_bullets = ""
        if rec.key_risk_drivers:
            # key_risk_drivers is stored as {"drivers": [...]}
            all_drivers = rec.key_risk_drivers.get('drivers', []) if isinstance(rec.key_risk_drivers, dict) else []
            
            # Logic for selection: MEDIUM risk band (2+2), then decision (APPROVED -> SAFE, DECLINED -> RISK)
            if rec.risk_band == 'MEDIUM':
                safe = [d for d in all_drivers if d.get('direction') == 'SAFE'][:2]
                risk = [d for d in all_drivers if d.get('direction') == 'RISK'][:2]
                selected_drivers = safe + risk
            elif rec.decision == 'APPROVED':
                # Use only SAFE drivers for approved applications
                selected_drivers = [d for d in all_drivers if d.get('direction') == 'SAFE'][:3]
                # If not enough SAFE drivers, fill with top RISK drivers (fallback)
                if not selected_drivers:
                    selected_drivers = all_drivers[:3]
            elif rec.decision == 'DECLINED':
                # Use only RISK drivers for declined applications
                selected_drivers = [d for d in all_drivers if d.get('direction') == 'RISK'][:3]
                # If not enough RISK drivers, fill with top SAFE drivers (fallback)
                if not selected_drivers:
                    selected_drivers = all_drivers[:3]
            else:
                selected_drivers = all_drivers[:3]

            if selected_drivers:
                driver_bullets = '<h3 style="color: #2c3e50; font-size: 16px; margin-top: 20px;">Key Factors Influencing Your Assessment:</h3><ul style="padding-left: 20px;">'
                
                # Descriptive helper logic - Provice proper sentences
                def get_desc(feat, is_risk):
                    f = feat.lower()
                    if 'upi_bounce' in f: 
                        return 'High UPI bounce rates suggest potential cash flow stress and financial instability.' if is_risk else 'A very low UPI bounce rate demonstrates excellent financial discipline and cash management.'
                    if 'bill_payments' in f: 
                        # Using 0.8 as threshold for on-time pct from earlier code
                        return 'Recent delays in utility or bill payments indicate potential repayment risks.' if is_risk else 'Consistent on-time bill payments reflect a high level of financial responsibility.'
                    if 'salary' in f: 
                        return 'Irregularities in salary credits suggest income instability which may affect repayment.' if is_risk else 'Highly regular salary credits provide strong assurance of stable repayment capacity.'
                    if 'balance' in f or 'spend' in f: 
                        return 'Maintaining low average balances suggests limited financial buffers for contingencies.' if is_risk else 'Healthy average balances indicate strong financial resilience and liquidity.'
                    if 'bnpl' in f: 
                        return 'A history of poor BNPL repayments correlates with higher credit risk.' if is_risk else 'A solid track record with BNPL services serves as a positive indicator of creditworthiness.'
                    if 'bureau' in f or 'credit_score' in f: 
                        return 'A lower bureau credit score signals historical challenges in managing credit.' if is_risk else 'A strong bureau credit score provides a solid foundation for this application.'
                    if 'enquiries' in f: 
                        return 'Frequent recent credit enquiries may suggest credit-hungry behavior.' if is_risk else 'A controlled number of credit enquiries indicates stable financial planning.'
                    if any(x in f for x in ['loan_amount', 'emi', 'ratio']): 
                        return 'A high debt-to-income ratio significantly stretches your monthly repayment capacity.' if is_risk else 'A manageable debt-to-income ratio ensures comfortable repayment of the requested loan.'
                    return "This factor significantly impacted our risk assessment based on historical data." if is_risk else "This factor positively contributed to our assessment of your creditworthiness."

                for d in selected_drivers:
                    feat_raw = d.get("feature", "")
                    label = feat_raw.replace("_", " ").title()
                    is_risk = d.get("direction") == "RISK"
                    desc = get_desc(feat_raw, is_risk)
                    color = "#e74c3c" if is_risk else "#27ae60"
                    tag   = "Risk Factor" if is_risk else "Strength"
                    
                    driver_bullets += f"""
                    <li style="margin-bottom: 12px;">
                        <strong style="color: #2c3e50;">{label}</strong>: {desc}
                        <br>
                        <span style="font-size: 11px; color: {color}; font-weight: bold; text-transform: uppercase;">[{tag}]</span>
                    </li>
                    """
                driver_bullets += "</ul>"

        # Trigger Decision Notification Email
        html_decision = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="cid:logo" alt="CreditVision Logo" style="width: 150px; height: auto;">
                </div>
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Update on your Credit Application</h2>
                <p>Dear <strong>{rec.full_name}</strong>,</p>
                <p>We wish to inform you that your credit application has been 
                   <span style="color: {'#27ae60' if rec.decision == 'APPROVED' else '#e74c3c'}; font-weight: bold; background: #f9f9f9; padding: 2px 5px; border-radius: 4px;">{rec.decision}</span>.</p>
                {driver_bullets}
                <br>
                <p>Regards,<br><strong>Plasmon-X Team</strong></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 11px; color: #999; text-align: center;">Reference: {rec.applicant_id} | Model v{MODEL_VERSION}</p>
            </div>
        </body>
        </html>
        """
        # Capture values to avoid DetachedInstanceError in background thread
        email_to   = rec.email
        full_name  = rec.full_name
        app_id_str = rec.applicant_id
        u_id       = user.user_id

        # Define the background work
        def background_email_work(to, name, app_id, html, user_id, h_id):
            print(f"[CV] Background task starting for {app_id}...")
            db_bg = SessionLocal()
            try:
                send_mock_email(
                    to=to,
                    name=name,
                    subject="Update on your Credit Application - CreditVision",
                    body=html,
                    include_logo=True
                )
                # Update record
                target_rec = db_bg.query(ApplicationHistory).filter_by(id=h_id).first()
                if target_rec:
                    print(f"[CV] Background task: Updating is_email_sent for {app_id}")
                    target_rec.is_email_sent = True
                    db_bg.commit()
                
                log_action(db_bg, user_id, "SEND_RESULT_MAIL", 
                           detail=f"Sent final decision email to {app_id} ({to})")
                print(f"[CV] Background task finished for {app_id}")
            except Exception as bg_e:
                print(f"[CV] Background task FAILED: {bg_e}")
            finally:
                db_bg.close()

        background_tasks.add_task(
            background_email_work, 
            email_to, full_name, app_id_str, html_decision, u_id, rec.id
        )
        print(f"[CV] Request handled for {app_id_str}, background task queued.")
        return {"message": "Email delivery initiated in background"}
    except Exception as e:
        import traceback
        with open("backend_error.log", "a") as f:
            f.write(f"\n{datetime.now()} - send_result_mail failed: {e}\n{traceback.format_exc()}\n")
        raise HTTPException(status_code=500, detail=f"Internal Error: {str(e)}")

@app.delete("/api/v1/admin/applicants/{history_id}", tags=["Admin"])
async def delete_applicant_record(
    history_id: int,
    user:       LoginCredentials = Depends(require_role("admin")),
    db:         Session = Depends(get_db)
):
    rec = db.query(ApplicationHistory).filter_by(id=history_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Applicant record not found")
    
    applicant_id = rec.applicant_id
    db.delete(rec)
    
    # Also clean up ActiveApplication if it matches
    active = db.query(ActiveApplication).filter_by(applicant_id=applicant_id).first()
    if active:
        db.delete(active)
        
    log_action(db, user.user_id, "DELETE_APPLICANT", detail=f"Deleted history #{history_id} (ID: {applicant_id})")
    db.commit()
    return {"message": f"Applicant {applicant_id} deleted successfully"}

# ─────────────────────────────────────────────
# LENDER — DASHBOARDS
# ─────────────────────────────────────────────
@app.get("/api/v1/lender/approved", tags=["Lender"])
async def approved_applicants(
    user: LoginCredentials = Depends(require_role("lender", "admin")),
    db:   Session = Depends(get_db)
):
    records = db.query(ApplicationHistory).filter_by(
        evaluated_by=user.user_id, decision="APPROVED"
    ).order_by(desc(ApplicationHistory.evaluated_at)).all()
    
    return [_serialize_history(r) for r in records]

@app.get("/api/v1/lender/history", tags=["Lender"])
async def lender_history(
    limit: int = 200,
    user:  LoginCredentials = Depends(require_role("lender", "admin")),
    db:    Session = Depends(get_db)
):
    records = (
        db.query(ApplicationHistory)
        .filter_by(evaluated_by=user.user_id)
        .order_by(desc(ApplicationHistory.evaluated_at))
        .limit(limit)
        .all()
    )
    return [_serialize_history(r) for r in records]

@app.get("/api/v1/lender/history/{applicant_id}", tags=["Lender"])
async def lender_applicant_detail(
    applicant_id: str,
    user: LoginCredentials = Depends(require_role("lender", "admin")),
    db:   Session = Depends(get_db)
):
    rec = (
        db.query(ApplicationHistory)
        .filter_by(applicant_id=applicant_id, evaluated_by=user.user_id)
        .order_by(desc(ApplicationHistory.evaluated_at))
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    log_action(db, user.user_id, "VIEW_APPLICANT", detail=f"Viewed {applicant_id}")
    return _serialize_history(rec)

@app.get("/api/v1/lender/stats", tags=["Lender"])
async def lender_stats(
    user: LoginCredentials = Depends(require_role("lender", "admin")),
    db:   Session = Depends(get_db)
):
    total    = db.query(func.count(ApplicationHistory.id)).filter_by(evaluated_by=user.user_id).scalar() or 0
    approved = db.query(func.count(ApplicationHistory.id)).filter_by(evaluated_by=user.user_id, decision="APPROVED").scalar() or 0
    review   = db.query(func.count(ApplicationHistory.id)).filter_by(evaluated_by=user.user_id, decision="UNDER_REVIEW").scalar() or 0
    declined = db.query(func.count(ApplicationHistory.id)).filter_by(evaluated_by=user.user_id, decision="DECLINED").scalar() or 0
    return {"total": total, "approved": approved, "under_review": review, "declined": declined}

# ─────────────────────────────────────────────
# UTILS
# ─────────────────────────────────────────────
def _serialize_history(r: ApplicationHistory) -> dict:
    return {
        "id": r.id,
        "applicant_id": r.applicant_id,
        "full_name": r.full_name,
        "email": r.email,
        "age": r.age,
        "employment_type": r.employment_type,
        "monthly_income": r.monthly_income,
        "loan_amount_requested": r.loan_amount_requested,
        "loan_tenure_months": r.loan_tenure_months,
        "total_emi_monthly": r.total_emi_monthly,
        "bureau_credit_score": r.bureau_credit_score,
        "existing_loans_count": r.existing_loans_count,
        "credit_enquiries_6m": r.credit_enquiries_6m,
        "credit_history_months": r.credit_history_months,
        "monthly_avg_transactions": r.monthly_avg_transactions,
        "monthly_avg_spend": r.monthly_avg_spend,
        "monthly_avg_balance": r.monthly_avg_balance,
        "salary_credit_regularity": r.salary_credit_regularity,
        "upi_bounce_rate": r.upi_bounce_rate,
        "months_of_txn_history": r.months_of_txn_history,
        "bnpl_active": r.bnpl_active,
        "bnpl_repayment_score": r.bnpl_repayment_score,
        "insurance_premium_active": r.insurance_premium_active,
        "min_balance_breach_count": r.min_balance_breach_count,
        "bill_payments_on_time_pct": r.bill_payments_on_time_pct,
        "risk_score": r.risk_score,
        "risk_band": r.risk_band,
        "pd_value": r.pd_value,
        "decision": r.decision,
        "is_email_sent": r.is_email_sent,
        "cold_start_flag": r.cold_start_flag,
        "bureau_available_flag": r.bureau_available_flag,
        "shap_values": r.shap_values,
        "key_risk_drivers": r.key_risk_drivers,
        "evaluated_by": r.evaluated_by,
        "evaluated_at": r.evaluated_at.isoformat() if r.evaluated_at else None,
        "model_version": r.model_version
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_version": MODEL_VERSION,
        "model_loaded": _model is not None,
        "scaler_loaded": _scaler is not None,
        "calibrator_loaded": _calibrator is not None,
        "shap_loaded": _explainer is not None,
        "optimal_threshold": _optimal_threshold,
        "feature_count": len(_feature_columns) if _feature_columns else len(FEATURE_COLUMNS_DEFAULT),
        "loaded_files": _loaded_files,
        "metadata": _model_metadata,
    }
# trigger reload
