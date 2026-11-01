# ExamGuard — Stage-by-Stage Build & Test Guide

Each stage below lists its goal, the files involved, how to run/test it on **Windows (PowerShell)**,
and the completion criteria. Everything listed is already implemented in this repository — use this
document to understand the system, demonstrate each feature, and debug if something misbehaves.

---

## Stage 1 — Architecture & environment
**Goal:** MERN stack verified: React SPA + Express API + MongoDB.
**Files:** `backend/server.js`, `backend/src/config/*`.
**Test:** `cd examguard/backend; npm run dev` → log shows `[db] connected` and `[api] listening`.
`curl http://localhost:5000/api/health` → `{"ok":true,"service":"examguard-api"}`.
**Done when:** health endpoint responds and MongoDB connection succeeds.

## Stage 2 — Backend, DB connection & authentication
**Goal:** Secure auth for all three roles.
**Files:** `models/User.js`, `middleware/auth.js`, `controllers/authController.js`.
**Behavior:** bcrypt hashing; JWT access (12 h) + refresh (7 d) httpOnly cookies; email verification
tokens (hashed, 24 h); password reset (hashed, 1 h); brute-force lockout (5 fails → 15 min).
**Test (PowerShell):**
```powershell
curl.exe -i -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"hr@examguard.test\",\"password\":\"Hr@12345\"}'
```
Wrong password 5× → 429 locked. **Done when:** login/me/refresh/logout all work.

## Stage 3 — Company registration & dashboard
**Goal:** Company signup → email verification → admin verification → HR dashboard.
**Files:** `controllers/authController.js` (registerCompany), `models/Company.js`, `pages/auth/*`, `pages/hr/HRDashboard.jsx`.
**Test:** register a new company; the dashboard shows a “verification pending” banner; publishing is
blocked until the platform admin verifies the company at `/admin`. **Done when:** banner clears and publish unlocks.

## Stage 4 — Examination creation & paper-pattern selection
**Goal:** Configure title, role, schedule, duration, marking, sections, monitoring, result visibility;
paper-pattern checkboxes (MCQ/Coding/Descriptive/Aptitude) with **at least one required**.
**Files:** `controllers/examController.js`, `pages/hr/CreateExam.jsx`.
**Test:** submit the form with zero types selected → both the browser (form error) and the API
(`400 “Select at least one question type…”`) reject it. **Done when:** exam appears on the dashboard.

## Stage 5 — Question management
**Goal:** Add/edit/reorder/remove questions of each selected type; marks + negative marks; hidden
test cases for coding; model answers for descriptive.
**Files:** `controllers/questionController.js`, `pages/hr/ExamQuestions.jsx`.
**Safety:** correct answers, hidden test cases and model answers are stripped from all candidate-facing
responses. **Test:** publish requires ≥1 question of every selected type. **Done when:** publish succeeds.

## Stage 6 — Email invitations & candidate registration
**Goal:** Individual + bulk invitations; cryptographically random tokens stored **hashed**; expiry,
revocation, resend; status pills (pending/sent/accepted/expired/revoked).
**Files:** `controllers/invitationController.js`, `services/mailer.js`, `pages/hr/ExamInvitations.jsx`, `pages/candidate/InvitationLanding.jsx`.
**Test:** invite yourself with a real email; open the link; register. With `EMAIL_PROVIDER=console`
the link is printed in the API console; “Copy link” always works. **Done when:** candidate can register from the link.

## Stage 7 — Candidate exam experience
**Goal:** Instructions → start → runner: server-controlled countdown (client clock skew corrected),
question palette, MCQ selection, code editor, autosave (8 s + on navigation), resume after refresh,
single submission (409 on duplicate), submit confirmation.
**Files:** `controllers/attemptController.js`, `pages/candidate/ExamRunner.jsx`.
**Test:** start an exam, refresh the page (timer keeps running — it is server-side), disconnect and
answer later — autosave restores. Try submitting twice → 409. **Done when:** submission confirmation shows.

## Stage 8 — Evaluation (MCQ + isolated coding)
**Goal:** MCQ/aptitude scored on the backend (with negative marking). Coding runs in a **separate
short-lived child process** (temp dir, hard timeout per test case, output normalized, partial credit
by passed/total). Descriptive answers enter manual review.
**Files:** `services/evaluator.js`, `controllers/resultController.js`.
**Test:** submit correct and wrong solutions; the feedback shows `Passed n/m hidden test cases`.
**Done when:** results rows show per-type scores. *Limitation:* this is basic isolation, not a hardened sandbox.

## Stage 9 — Browser security events (Layer A)
**Goal:** Tab visibility, focus loss, full-screen exit, copy/paste attempts, heartbeat — sent to
`POST /api/security/events`, throttled and validated server-side.
**Files:** `ExamRunner.jsx` (event hooks), `controllers/securityController.js`.
**Test:** switch tabs during an exam → Monitor page risk score rises. **Done when:** events appear in evidence.

## Stage 10 — Device-level monitoring (Layer B — simulation mode)
**Goal:** Honest device monitoring demo: the HR **demo simulator** injects clearly-labeled
`SIMULATED` events (prohibited app / remote desktop / screen share). Every alert card displays a
“simulated demo” tag. The system never claims a browser can enumerate processes.
**Files:** `controllers/securityController.js` (simulate), `pages/hr/ExamMonitor.jsx`.
**Done when:** simulated alerts are visually distinguished from browser signals.

## Stage 11 — Behavioral analysis engine (rule-based)
**Goal:** Configurable weights per event type, 15-minute sliding window, per-type caps (5), multi-signal
bonus (+10), configurable medium/high/critical thresholds; alerts carry human-readable **reasons**.
**Files:** `services/securityEngine.js`, Monitor page rules editor.
**Test:** one simulated prohibited app (weight 70) → alert; add tab switches → reasons list grows and
risk level escalates. **Done when:** every alert explains itself.

## Stage 12 — Alert review & results reporting
**Goal:** Dark security console with filters, explainable reasons, evidence list, review states
(new / under review / resolved / inconclusive) + notes. Results: per-type breakdown, ranks, completion
time, security-review column (separate from scores), CSV export, manual descriptive scoring, result
release control.
**Files:** `pages/hr/AlertsConsole.jsx`, `pages/hr/ExamResults.jsx`, `controllers/resultController.js`.
**Done when:** CSV downloads and a descriptive answer can be scored manually.

## Stage 13 — Testing & documentation
**Goal:** End-to-end verification.
**Test:** full walkthrough in README → register → verify → create → publish → invite → candidate
exam → monitoring → alerts → results → CSV. **Done when:** every step passes.

---

### Where the honest limitations live
- Coding evaluator: child-process isolation only (README §Security design).
- Device monitoring: simulation mode only, always labeled.
- Rule engine: deterministic weights, no ML, no accuracy claims.
- Section time limits are recorded and displayed but not hard-enforced by the timer (documented v2 item).
