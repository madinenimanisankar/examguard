# ExamGuard

**Smart Online Assessments. Intelligent Security. Trusted Results.**

ExamGuard is a web-based examination conducting platform for companies and HR teams, with
configurable security monitoring, a rule-based (explainable) behavioral analysis engine, and a
human review workflow for suspicious-activity alerts.

Core principle: **detect suspicious behavior, not just suspicious applications.** Technical
detections are treated as contextual signals — never as automatic proof of misconduct.

> **Honest scope (please read before your demonstration)**
> - A normal web browser **cannot** reliably enumerate the processes running on a candidate's
>   computer. Browser monitoring (Layer A) records tab visibility, focus and full-screen changes only.
> - Device-level application monitoring is provided as a **clearly-labeled simulation mode** for
>   development and demos. Simulated events are tagged `SIMULATED DEMO` everywhere they appear.
> - The coding evaluator runs candidate code in a **short-lived child process** (temp directory,
>   hard timeout, no app credentials). This is basic isolation — **not a hardened sandbox**.
> - The behavioral engine is **rule-based**, not machine learning. No detection-accuracy claims are
>   made; every alert lists the exact reasons that produced it.

---

## Architecture

```
┌───────────────────────────┐  REST/JSON   ┌──────────────────────────┐        ┌─────────────┐
│  React SPA (CRA)          │ ───────────► │  Express.js REST API     │ ─────► │  MongoDB    │
│  - HR portal              │  JWT cookies │  - auth & RBAC           │ Mongoose│ users       │
│  - candidate exam runner  │ ◄─────────── │  - exams/questions       │        │ companies   │
│  - security alerts console│  httpOnly    │  - invitations/attempts  │        │ exams, ...  │
└───────────────────────────┘              │  - rule engine (Layer C) │        └─────────────┘
       Layer A: browser events             └──────────────────────────┘
       Layer B: device events (simulated, clearly labeled)      Layer D: configurable rules
```

Three roles: **HR** (company), **candidate**, **platform administrator**. Company data is isolated:
every exam query is scoped to the caller's company; foreign records return 404 (existence is not leaked).

## Repository layout

```
examguard/
├── backend/                  # Express + Mongoose REST API
│   ├── server.js             # entry: helmet, CORS, rate limits, routes
│   └── src/
│       ├── config/           # env, db connection
│       ├── models/           # User, Company, Exam, Question, Invitation, Registration,
│       │                     # ExamSession, Submission, SecurityEvent, SecurityAlert, AuditLog
│       ├── middleware/       # auth (JWT + roles), error handling
│       ├── controllers/      # auth, exams, questions, invitations, attempts, security, results, admin
│       ├── services/         # mailer (managed Resend), evaluator (MCQ + code runner), securityEngine
│       └── scripts/seed.js   # idempotent demo data
├── frontend/                 # React (CRA + Tailwind + shadcn/ui)
│   └── src/pages/            # landing, auth, hr/, candidate/, admin
└── docs/BUILD_STAGES.md      # stage-by-stage build & test guide (Windows commands)
```

## Quick start (Windows, PowerShell)

Prerequisites: **Node.js 18+**, **MongoDB 6+** running locally (`mongod`), Git.

```powershell
# 1) Backend
cd examguard/backend
copy .env.example .env        # then edit: set JWT_SECRET to 64 random hex chars
npm install
npm run seed                  # creates admin, demo companies, exam, candidates
npm run dev                   # API on http://localhost:5000

# 2) Frontend (second terminal)
cd examguard/frontend
copy .env.example .env        # REACT_APP_BACKEND_URL=http://localhost:5000
npm install
npm start                     # app on http://localhost:3000
```

### Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Platform admin | (your `ADMIN_EMAIL`) | (your `ADMIN_PASSWORD`) |
| HR — Acme Technologies (verified) | hr@examguard.test | Hr@12345 |
| HR — Other Corp (pending) | hr2@examguard.test | Hr@12345 |
| Candidate | candidate@examguard.test | Candidate@123 |

## Full demo walkthrough

1. Register a company at `/register` → verify email → log in.
2. Log in as platform admin (`/admin`) → **Companies → Verify** the new company (publishing is
   blocked until verified).
3. As HR: **Create examination** → select at least one paper-pattern type (MCQ/Coding/Descriptive/
   Aptitude — creation is rejected with none) → add questions → **Publish**.
4. **Invitations**: paste candidate emails → each receives a secure single-use link (tokens are
   stored **hashed**; “Copy link” mints a fresh link shown once).
5. Candidate opens the link → registers → **View instructions & start** → exam runner with
   server-controlled countdown, question palette, autosave, code editor.
6. Switch tabs / lose focus during the exam → browser events are recorded (Layer A).
7. HR **Monitor** page: live sessions; the **demo simulator** injects clearly-labeled simulated
   device events (Layer B demo mode) — watch risk scores and explainable reasons.
8. **Security alerts console** (dark): filter alerts, read the reasons, record a review decision
   (under review / resolved / inconclusive) with notes.
9. **Results**: backend-evaluated scores, per-type breakdown, rankings, security-review column
   (kept separate from scores), CSV export, manual descriptive scoring, result release.

## Security design

- bcryptjs password hashing; JWT access (12 h) + refresh (7 d) in httpOnly cookies.
- Role-based authorization middleware + company-scoped queries (tenant isolation; 404 on foreign records).
- Brute-force lockout (5 fails → 15 min), global + per-route rate limits, Mongo operator sanitization.
- Invitation tokens: `crypto.randomBytes(32)` stored as SHA-256 hashes with expiry and revocation.
- Server-side exam timing (`endsAt = min(start + duration, window end)`), single session per candidate,
  idempotent submit (409 on duplicate), refresh-safe answer autosave.
- Audit log for logins, publishes, invitation sends, alert reviews, CSV exports, admin access.
- Correct answers / hidden test cases / model answers are never sent to the browser before submission.

## Configuration (backend/.env)

| Key | Meaning |
|---|---|
| `MONGO_URL`, `DB_NAME` | MongoDB connection |
| `JWT_SECRET` | 64-char random hex (required) |
| `APP_BASE_URL` | Frontend origin used in email links |
| `EMAIL_PROVIDER` | `console` (log only) or `resend` (real email) |
| `EMERGENT_EMAIL_KEY` / `RESEND_API_KEY` | Managed proxy key (inside Emergent) or your own Resend key |
| `EMAIL_FROM_NAME` | Sender display name shown in emails |
| `PYTHON_CMD` / `NODE_CMD` | Commands used by the coding evaluator |

## What is intentionally *not* claimed

- No guarantee that every prohibited application or remote-access tool is detected.
- No claim that a single signal proves misconduct — reviewers decide, with notes and states
  (new / under review / resolved / inconclusive).
- No ML accuracy claims. If ML is added later, document datasets and false-positive/-negative rates.
