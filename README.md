# CreditVision — Advanced Credit Risk Assessment Platform

![CreditVision Logo](frontend/public/CV_Logo.png)

CreditVision is a state-of-the-art, AI-powered credit risk assessment platform designed for modern financial institutions. It leverages advanced machine learning to provide precise credit scoring, transparent risk explainability (SHAP), and a professional workflow for lenders.

---

## 🚀 Key Features

### 🏦 AI-Powered Scoring Engine
- **30-Feature ML Model**: Utilizes a calibrated logistic regression model trained on 30 critical financial and behavioral features.
- **Automated Risk Banding**: Categorizes applicants into bands (Optimal, Low, Medium, High, Critical) based on Probability of Default (PD).
- **Cold-Start Handling**: Specialized logic for applicants without traditional bureau history using alternative transaction data.

### 🔍 Explainable AI (XAI) & SHAP
- **SHAP Integration**: Every score includes a detailed breakdown of the key drivers (income, EMI, bounce rates, etc.) contributing to the risk assessment.
- **Dynamic Driver Summaries**:
    - **APPROVED Applications**: Focuses on positive strength factors (SAFE drivers).
    - **DECLINED Applications**: Focuses on primary risk factors (RISK drivers).
    - **MEDIUM Risk Band**: Provides a balanced view with 2 positive and 2 negative drivers for complete transparency.
- **Proper Sentences**: All feedback is translated from technical keywords into professional, easy-to-understand sentences.

### 📧 Professional Notification System
- **Access Alerts**: Automatic "Data Access" notifications sent to applicants upon evaluation.
- **Decision Workflow**: Seamless "Approve" or "Decline" actions with dedicated email triggers for finalized decisions.
- **Tailored Feedback**: Emails include specific reasons for the decision, helping applicants understand their credit profile better.
- **Official Branding**: Professional email templates embedded with the CreditVision logo for institutional trust.

### 🛡️ Institutional Workflow
- **Lender Dashboard**: Real-time monitoring of application history and approved loan pipelines.
- **Role-Based Access**: Secure authentication with JWT for admins and lenders.
- **Audit Logs**: Full activity logging for administrative oversight.

---

## 🛠️ Technology Stack

The CreditVision platform is built using a modern, high-performance stack curated for scalability, security, and a premium user experience.

### ⚡ Backend Gateway (FastAPI)
- **High-Performance API**: Powered by [FastAPI](https://fastapi.tiangolo.com/), ensuring sub-millisecond overhead for ML inference.
- **Asynchronous Execution**: Leverages Python's `asyncio` for non-blocking task handling (notifications and background processing).
- **Automated Documentation**: Interactive API testing available out-of-the-box via Swagger/OpenAPI at `/docs`.
- **Robust Security**: Industry-standard **JWT (JSON Web Tokens)** for stateless authentication and **Bcrypt** for hashing.

### 🧠 Machine Learning Engine
- **Calibrated Scoring**: Uses **Logistic Regression** with a **CalibratedClassifierCV** wrapper to ensure risk probabilities are accurate and reliable.
- **Explainable AI (SHAP)**: Integrated [SHAP (SHapley Additive exPlanations)](https://shap.readthedocs.io/) to provide mathematical proof for every risk decision.
- **Scalable Processing**: Data handling optimized with **NumPy** and **Pandas** for real-time vectorization.

### 🎨 Frontend Experience (React + Vite)
- **Modern Architecture**: Built with **React 18** and **Vite** for lightning-fast HMR and optimized production builds.
- **Dynamic Interactions**: **Framer Motion** powers smooth transitions and micro-animations, creating a high-end, responsive feel.
- **Clean Design**: Optimized **Vanilla CSS** with a custom design system focusing on glassmorphism, depth, and accessibility.

### 🗄️ Database & Infrastructure
- **PostgreSQL**: Industrial-grade relational database for structured financial data and audit trails.
- **SQLAlchemy (ORM)**: Type-safe database interactions with robust migration support via a 5-table schema.
- **Modular Design**: Clean separation of concerns between models, routes, and business logic.

---

## 📁 Project Structure

```text
├── backend/                # FastAPI Application & ML Engine
│   ├── models/             # joblib files (Model, Scaler, Explainer)
│   ├── main.py             # API Routes & Business Logic
│   ├── models_db.py        # SQLAlchemy ORM Models
│   ├── requirements.txt    # Python Dependencies
│   └── test_inputs.json    # Sample data for UI autofill
├── frontend/               # React Application
│   ├── src/                # Components, Pages, and Styling
│   ├── public/             # Branding Assets (Logos)
│   └── package.json        # Node.js Dependencies
├── sql/                    # Database Scripts
│   └── schema.sql          # PostgreSQL Table Definitions
├── .env.example            # Template for environment variables
├── requirements.txt        # Root Python Dependencies
└── README.md               # Project Documentation
```

---

## ⚙️ Setup & Installation

### 1. Database Setup
Ensure PostgreSQL is running and create a database named `cv_project`.
Apply the schema:
```bash
psql -U postgres -d cv_project -f sql/schema.sql
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```
Create a `.env` in the `backend/` directory following the `.env.example`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🎨 Branding
The project follows a "CreditVision Blue" theme. All official assets are located in `frontend/public/` and `backend/`.

---
**Team**: Plasmon-X
