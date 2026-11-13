const env = require('../config/env');
const { escapeHtml } = require('../utils/helpers');

// Mirrors the platform's email guardrails: no forms, no credential asks,
// only absolute first-party links, no shorteners / IP hosts / punycode.
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'goo.gl', 'rebrand.ly'];
const CRED_ASK = [
  'reply with your password', 'reply with the code', 'send your password', 'cvv',
  'send us your password', 'enter your password below', 'confirm your card number',
  'your full card number', 'seed phrase', 'recovery phrase', 'verify your card',
  'social security number', 'confirm your bank details',
];

function assertSafeEmail(subject, html) {
  if (/<(form|input|textarea|select)[\s>]/i.test(html)) throw new Error('G2: forms are not allowed in email');
  const body = `${subject}\n${html}`.toLowerCase();
  for (const p of CRED_ASK) if (body.includes(p)) throw new Error(`G2: credential-ask phrasing "${p}"`);
  const urls = [...html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const raw of urls) {
    const u = raw.trim().toLowerCase();
    if (/^(mailto:|tel:|cid:|#)/.test(u)) continue;
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(u);
    if (!u.startsWith('https://') && !isLocal) throw new Error(`G3: links must be absolute https: ${raw}`);
    let host;
    try {
      host = new URL(u).hostname;
    } catch {
      throw new Error(`G3: malformed url ${raw}`);
    }
    if (!host || host.includes('xn--') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || SHORTENERS.some((s) => host === s || host.endsWith(`.${s}`))) {
      throw new Error(`G3: unsafe link host ${host}`);
    }
  }
}

function layout(title, bodyHtml, buttonUrl, buttonText) {
  const btn = buttonUrl
    ? `<a href="${buttonUrl}" style="display:inline-block;background:#1D4ED8;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(buttonText)}</a>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
<tr><td style="background:#0B1220;padding:20px 28px;"><span style="color:#ffffff;font-size:18px;font-weight:bold;">ExamGuard</span><br/><span style="color:#94A3B8;font-size:11px;">Smart Online Assessments. Intelligent Security. Trusted Results.</span></td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 12px;font-size:20px;color:#0F172A;">${escapeHtml(title)}</h1>
${bodyHtml}
<div style="margin:24px 0;">${btn}</div>
</td></tr>
<tr><td style="padding:16px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px;">Sent by ${escapeHtml(env.emailFromName)}. We never ask for your password or card details by email.</td></tr>
</table></td></tr></table></body></html>`;
}

const fmt = (d) => new Date(d).toLocaleString('en-IN', { timeZone: env.displayTz, dateStyle: 'medium', timeStyle: 'short' });

async function sendEmail({ to, subject, html }) {
  assertSafeEmail(subject, html);
  // Your OWN mail id via SMTP (Gmail with an App Password, or any SMTP server).
  if (env.emailProvider === 'smtp') {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: Number(env.smtpPort),
        secure: Number(env.smtpPort) === 465,
        auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
      });
      const info = await transporter.sendMail({
        from: env.fromEmail ? `${env.emailFromName} <${env.fromEmail}>` : env.emailFromName,
        to,
        subject,
        html,
      });
      return { ok: true, id: info.messageId };
    } catch (e) {
      console.error('[email:smtp] send failed:', e.message);
      return { ok: false, reason: `smtp: ${String(e.message).slice(0, 120)}` };
    }
  }
  if (env.emailProvider === 'resend') {
    try {
      if (env.emergentEmailKey) {
        const payload = { to: [to], subject, html, from_name: env.emailFromName };
        if (env.emailReplyTo) payload.contact_email = env.emailReplyTo;
        const resp = await fetch('https://integrations.emergentagent.com/api/v1/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Email-Key': env.emergentEmailKey },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          console.warn(`[email] not sent (${data.code || resp.status}): ${data.message || ''}`);
          return { ok: false, reason: data.code || `http_${resp.status}` };
        }
        const data = await resp.json().catch(() => ({}));
        return { ok: true, id: data.id };
      }
      if (env.resendApiKey) {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.resendApiKey}` },
          body: JSON.stringify({ from: `${env.emailFromName} <${env.fromEmail || 'onboarding@resend.dev'}>`, to: [to], subject, html }),
        });
        if (!resp.ok) {
          console.warn(`[email] resend failed: ${resp.status}`);
          return { ok: false, reason: `http_${resp.status}` };
        }
        const data = await resp.json().catch(() => ({}));
        return { ok: true, id: data.id };
      }
      console.warn('[email] EMAIL_PROVIDER=resend but no key configured; using console mode');
    } catch (e) {
      console.error('[email] send error:', e.message);
      return { ok: false, reason: 'network' };
    }
  }
  console.log(`\n===== [email:console] =====\nTo: ${to}\nSubject: ${subject}\n${html}\n===========================\n`);
  return { ok: false, reason: 'console' };
}

function sendVerificationEmail(user, token, baseUrl) {
  const url = `${baseUrl || env.appBaseUrl}/verify-email?token=${token}`;
  const html = layout(
    'Verify your email address',
    `<p style="color:#334155;font-size:14px;line-height:1.6;">Hi ${escapeHtml(user.name)},</p>
     <p style="color:#334155;font-size:14px;line-height:1.6;">Welcome to ExamGuard. Please confirm your email address to activate your company account.</p>
     <p style="color:#64748B;font-size:13px;">This link expires in 24 hours.</p>`,
    url,
    'Verify my email'
  );
  return sendEmail({ to: user.email, subject: 'Verify your ExamGuard account', html });
}

function sendInvitationEmail({ to, companyName, exam, token, baseUrl }) {
  const url = `${baseUrl || env.appBaseUrl}/candidate/invitation/${token}`;
  const neg = exam.negativeMarking?.enabled ? `<li style="color:#334155;font-size:14px;">Negative marking: -${escapeHtml(String(exam.negativeMarking.defaultNegative))} per wrong MCQ answer</li>` : '';
  const html = layout(
    `You are invited: ${exam.title}`,
    `<p style="color:#334155;font-size:14px;line-height:1.6;"><strong>${escapeHtml(companyName)}</strong> has invited you to take an online assessment on ExamGuard.</p>
     <ul style="color:#334155;font-size:14px;line-height:1.8;padding-left:18px;">
       <li>Assessment: <strong>${escapeHtml(exam.title)}</strong> (${escapeHtml(exam.jobRole)})</li>
       <li>Window opens: ${fmt(exam.startAt)}</li>
       <li>Window closes: ${fmt(exam.endAt)}</li>
       <li>Duration: ${exam.durationMinutes} minutes</li>${neg}
     </ul>
     <p style="color:#64748B;font-size:13px;">Use this invitation only on the device you will take the assessment with. Your activity inside the exam (tab switches, focus loss) may be recorded as contextual security signals for review by ${escapeHtml(companyName)}.</p>`,
    url,
    'Register with my invitation'
  );
  return sendEmail({ to, subject: `Invitation: ${exam.title} — ${companyName}`, html });
}

function sendResetEmail(user, token, baseUrl) {
  const url = `${baseUrl || env.appBaseUrl}/reset-password?token=${token}`;
  const html = layout(
    'Reset your password',
    `<p style="color:#334155;font-size:14px;line-height:1.6;">Hi ${escapeHtml(user.name)},</p>
     <p style="color:#334155;font-size:14px;line-height:1.6;">We received a request to reset your ExamGuard password. Open the button below and choose a new password.</p>
     <p style="color:#64748B;font-size:13px;">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`,
    url,
    'Choose a new password'
  );
  return sendEmail({ to: user.email, subject: 'Reset your ExamGuard password', html });
}

function sendCompanyVerifiedEmail(company, owner) {
  const url = `${env.appBaseUrl}/login`;
  const html = layout(
    'Your company account is verified',
    `<p style="color:#334155;font-size:14px;line-height:1.6;">Hi ${escapeHtml(owner.name)},</p>
     <p style="color:#334155;font-size:14px;line-height:1.6;">The ExamGuard platform team has verified <strong>${escapeHtml(company.name)}</strong>. You can now publish examinations and invite candidates.</p>`,
    url,
    'Go to my dashboard'
  );
  return sendEmail({ to: owner.email, subject: 'ExamGuard: company verified', html });
}

module.exports = { sendEmail, sendVerificationEmail, sendInvitationEmail, sendResetEmail, sendCompanyVerifiedEmail };
