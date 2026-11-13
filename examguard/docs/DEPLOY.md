# ExamGuard — Production Deployment Guide (your own server, your own email)

This guide takes ExamGuard from the demo to a real deployment under **your** domain and
**your** email identity — no Emergent-specific pieces.

## 1. What you need
- A VPS (DigitalOcean / AWS EC2 / Azure VM): Ubuntu 22.04, 2–4 vCPU, 4–8 GB RAM
- A domain (e.g. `exams.yourdomain.com`) pointing (A record) to the VPS IP
- Node.js 18+ (`sudo apt install nodejs npm` or via nvm), Git, Nginx, pm2 (`sudo npm i -g pm2`)
- A MongoDB: **MongoDB Atlas** free/M10 cluster (easiest) or `mongod` on the same VPS

## 2. Get the code onto the server
```bash
git clone <your-repo-url> /opt/examguard        # or scp the zip and unzip it
cd /opt/examguard/backend
```

## 3. Backend configuration
```bash
cp .env.example .env
nano .env
```
Set:
- `MONGO_URL` → your Atlas connection string (allow the server IP in Atlas Network Access)
- `DB_NAME=examguard`
- `JWT_SECRET` → `openssl rand -hex 32`
- `APP_BASE_URL=https://exams.yourdomain.com`  ← invitation links use this
- **Your own email** (see §5)
Then:
```bash
npm install
node src/scripts/seed.js     # creates your admin account
pm2 start server.js --name examguard-api -i max   # cluster mode: one process per CPU core
pm2 save && pm2 startup       # restart on reboot
```

## 4. Frontend build
```bash
cd ../frontend
cp .env.example .env
# IMPORTANT: leave REACT_APP_BACKEND_URL EMPTY for same-domain deployment —
# the app then calls relative "/api", which Nginx proxies to the backend:
#   REACT_APP_BACKEND_URL=
npm install
npm run build                 # produces build/
```

## 5. Email from YOUR mail id — two options

**Option A — your Gmail id (simplest for a college project):**
1. Turn on 2-Step Verification on the Google account
2. Create an App Password: https://myaccount.google.com/apppasswords (16 chars)
3. In `backend/.env`:
```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=yourname@gmail.com
SMTP_PASS=your16charapppassword
EMAIL_FROM_NAME=ExamGuard
```
Candidates receive mail **from yourname@gmail.com**. Gmail caps ~500 mails/day — fine for a demo,
use Option B for larger batches.

**Option B — your own domain (professional):**
1. Create a free resend.com account, verify `yourdomain.com` (add the DKIM/SPF DNS records it shows)
2. In `.env`:
```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxx
FROM_EMAIL=exams@yourdomain.com
```
Candidates receive mail from `exams@yourdomain.com` (thousands/day on the free tier).

## 6. Nginx (site + API on one domain, HTTPS)
```nginx
server {
    listen 80;
    server_name exams.yourdomain.com;
    client_max_body_size 2m;

    # React build (static)
    root /opt/examguard/frontend/build;
    index index.html;
    location / { try_files $uri /index.html; }   # SPA routing

    # API → Express (pm2) on :5000
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/examguard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d exams.yourdomain.com
```
Done — `https://exams.yourdomain.com` is live: cookies are `sameSite=lax` and same-origin, so
authentication just works.

## 7. First run checklist
1. Visit the site → register your company → verify email (arrives from YOUR mail id)
2. Log in as admin (seeded `ADMIN_EMAIL`) → Companies → Verify your company
3. Create exam → questions → publish → invite a real candidate email → take the exam end to end
4. Change `ADMIN_PASSWORD` before the demo; never commit `.env` (already in `.gitignore`)

## 8. Capacity tuning (see also the concurrency explanation)
- `pm2 start -i max` → Node cluster across all cores (×N throughput)
- MongoDB Atlas: M10 handles ~hundreds of users; M20/M30 for thousands
- Coding evaluator is CPU-bound: at large scale, move it to a queue (BullMQ + Redis) with
  N worker processes — cap concurrent code executions
- Static files: Nginx serves `build/` directly (gzip on); put a CDN in front if needed
- Backups: Atlas continuous backups, or `mongodump` cron

## 9. Monitoring & logs
```bash
pm2 logs examguard-api        # API logs (incl. [email:console] in dev)
pm2 monit                     # CPU/RAM live
tail -f /var/log/nginx/error.log
```
Audit logs (logins, publishes, exports, reviews) are viewable in-app at /admin → Audit log.

---

# Alternative: FREE hosting — Vercel (frontend) + Render (backend)

Vercel cannot run the Express backend (serverless only), so split it:

**Backend → Render.com (free):**
1. New → Web Service → connect your GitHub repo → Root Directory: `examguard/backend`
2. Build Command: `npm install` · Start Command: `node server.js` · Health Check Path: `/api/health`
3. Environment → add:
   | Key | Value |
   |---|---|
   | NODE_ENV | production |
   | MONGO_URL | your Atlas connection string |
   | DB_NAME | examguard |
   | JWT_SECRET | openssl rand -hex 32 |
   | APP_BASE_URL | https://your-frontend.vercel.app |
   | EMAIL_PROVIDER | smtp |
   | SMTP_HOST | smtp.gmail.com |
   | SMTP_PORT | 465 |
   | SMTP_USER | yourname@gmail.com |
   | SMTP_PASS | your 16-char Gmail App Password |
   | EMAIL_FROM_NAME | ExamGuard |
   | ADMIN_EMAIL / ADMIN_PASSWORD | your values |
   | PYTHON_CMD | python3 · NODE_CMD | node |
4. Deploy → you get `https://examguard-api.onrender.com` (free tier sleeps after 15 min idle — first request takes ~50 s; upgrade or a cron ping keeps it warm).

**Frontend → Vercel (free):**
1. Root Directory: `examguard/frontend` · preset: Create React App (build `npm run build`, output `build`)
2. A `vercel.json` is included that proxies same-origin `/api/*` to your Render URL —
   **edit its destination to your real Render URL**, and set NO `REACT_APP_BACKEND_URL`
   (the app then calls relative `/api`; cookies and auth work without CORS changes).
3. Deploy → share the Vercel URL with candidates.

**Note:** Render's native Node runtime may lack Python — set coding questions to JavaScript only,
or switch the Render service to its Docker runtime with `python3` installed.

