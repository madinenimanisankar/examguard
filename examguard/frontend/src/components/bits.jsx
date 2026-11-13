import { Link } from "react-router-dom";
import { ShieldAlert, Inbox } from "lucide-react";

export function RiskBadge({ level, score }) {
  const tones = {
    low: "bg-slate-100 text-slate-600 border-slate-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    high: "bg-orange-50 text-orange-700 border-orange-300",
    critical: "bg-red-50 text-red-700 border-red-300",
  };
  const dark = {
    low: "bg-slate-800/60 text-slate-300 border-slate-700",
    medium: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    high: "bg-orange-500/10 text-orange-300 border-orange-500/30",
    critical: "bg-red-500/15 text-red-300 border-red-500/40",
  };
  return (
    <span data-testid="risk-badge" className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${dark[level] || tones[level] || tones.low}`}>
      <ShieldAlert className="h-3 w-3" />
      {level}{score != null ? ` · ${score}` : ""}
    </span>
  );
}

const PILL_TONES = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-400 border-slate-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expired: "bg-slate-100 text-slate-500 border-slate-200",
  revoked: "bg-red-50 text-red-600 border-red-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-violet-50 text-violet-700 border-violet-200",
  new: "bg-red-50 text-red-700 border-red-200",
  under_review: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inconclusive: "bg-slate-100 text-slate-600 border-slate-200",
  clear: "bg-emerald-50 text-emerald-700 border-emerald-200",
  review_pending: "bg-amber-50 text-amber-700 border-amber-200",
  pending_review: "bg-amber-50 text-amber-700 border-amber-200",
};

export function StatusPill({ status, className = "" }) {
  return (
    <span data-testid="status-pill" className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PILL_TONES[status] || "bg-slate-100 text-slate-600 border-slate-200"} ${className}`}>
      {String(status || "—").replace(/_/g, " ")}
    </span>
  );
}

export function Empty({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-14 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <div>
        <p className="font-display font-semibold">{title}</p>
        {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHead({ title, subtitle, right, testid }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl" data-testid={testid || "page-title"}>{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, tone = "", testid }) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${tone}`} data-testid={testid || "stat-card"}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold" data-testid={`${testid || "stat"}-value`}>{value}</p>
    </div>
  );
}

export function LinkButton({ to, children, variant = "primary", testid, className = "" }) {
  const base = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors";
  const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border bg-card hover:bg-accent";
  return (
    <Link to={to} data-testid={testid} className={`${base} ${styles} ${className}`}>
      {children}
    </Link>
  );
}
