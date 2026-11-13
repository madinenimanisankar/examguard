# ExamGuard — Step-by-step deployment (GitHub → Render backend → Vercel frontend)

Order matters: MongoDB Atlas → GitHub → Render (backend) → Vercel (frontend) → connect them.

## 1. MongoDB Atlas (database)
1. cloud.mongodb.com → create a free M0 cluster.
2. Database Access → add user (username + password).
3. Network Access → Add IP → `0.0.0.0/0` (Render has no fixed IP on free tier).
4. Connect → Drivers → copy `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net` → this is `MONGO_URL`.

## 2. GitHub
1. Extract the zip. Your repo root must contain `backend/`, `frontend/`, `docs/`, `README.md`.
2. Check `.gitignore` includes `node_modules`, `.env`, `build` (it does).
3. In the project folder:
   ```
   git add .
   git commit -m "Production deploy setup"
   git push
   ```
4. Never commit `backend/.env` — secrets go into the Render dashboard.

## 3. Render (backend API)
render.com → New → Web Service → connect your GitHub repo.

| Field | Value |
|---|---|
| Root Directory | `backend` (or `examguard/backend` if your repo has an outer `examguard` folder) |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check Path | `/api/health` |

Environment variables:
```
NODE_ENV=production
MONGO_URL=<Atlas string from step 1>
DB_NAME=examguard
JWT_SECRET=<64 random hex chars>
APP_BASE_URL=https://<your-project>.vercel.app
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<your gmail>
SMTP_PASS=<16-char Gmail App Password, no spaces>
FROM_EMAIL=<your gmail>
EMAIL_FROM_NAME=ExamGuard
ADMIN_EMAIL=<your email>
ADMIN_PASSWORD=<strong password>
NODE_CMD=node
PYTHON_CMD=python3
DISPLAY_TZ=Asia/Kolkata
```
Do NOT set `PORT` — Render sets it.
Deploy → open `https://<name>.onrender.com/api/health` → must show `{"ok":true,...}`.

## 4. Vercel (frontend)
1. Edit `frontend/vercel.json` → replace `https://examguard-api.onrender.com` with YOUR Render URL → commit + push.
2. vercel.com → Add New → Project → import repo.

| Field | Value |
|---|---|
| Root Directory | `frontend` (or `examguard/frontend`) |
| Framework Preset | Create React App |
| Build / Output / Install | leave default — `vercel.json` sets them |
| Environment Variables | none (leave `REACT_APP_BACKEND_URL` unset) |

3. Deploy → you get `https://<project>.vercel.app`.
4. If that URL differs from `APP_BASE_URL` on Render, update it there and redeploy Render.

## 5. First run
1. Open the Vercel URL → Register company → verification email arrives from your Gmail.
2. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → Admin → verify the company.
3. Log in as HR → create exam → add questions → publish → invite candidates.
4. Any failed email shows a red "Failed" badge — fix the setting, then "Resend all failed".

## Troubleshooting
| Symptom | Fix |
|---|---|
| Login works then logs out / 401 | Frontend must call `/api` through the Vercel rewrite; don't set `REACT_APP_BACKEND_URL` |
| Refresh on a page shows 404 | Make sure `vercel.json` (with the index.html rewrite) is in `frontend/` |
| First request very slow | Render free tier sleeps after 15 min; first request wakes it (~50 s) |
| Email "Invalid login 535" | Use a Gmail App Password, 2-Step Verification on |
| Email `ETIMEDOUT` | Set `SMTP_PORT=587` |
| Mongo connection error | Atlas Network Access must allow `0.0.0.0/0`; check user/password in URL |
| Python coding questions fail on Render | Render Node image may not have Python — use JavaScript questions or a Docker service |

## Local development (laptop)
```
# terminal 1
cd backend
npm install
cp .env.example .env      # fill values (EMAIL_PROVIDER=smtp for real mail)
npm run seed              # optional demo data
npm run dev               # http://localhost:5000

# terminal 2
cd frontend
npm install --legacy-peer-deps
# frontend/.env: REACT_APP_BACKEND_URL=http://localhost:5000
npm start                 # http://localhost:3000
```
Test email: `cd backend && npm run test-email -- you@gmail.com`
