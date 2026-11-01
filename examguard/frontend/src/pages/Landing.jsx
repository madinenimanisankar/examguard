import { Link } from "react-router-dom";
import { ShieldCheck, Monitor, FileSearch, Radar, ClipboardList, BarChart3, ArrowRight, ScanLine, Eye, Lock } from "lucide-react";

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Examination management",
    body: "Create assessments with MCQ, coding, aptitude and descriptive questions. Configure marks, negative marking, schedules and section-wise limits.",
  },
  {
    icon: Monitor,
    title: "Layered monitoring",
    body: "Browser signals (tab switches, focus loss, full-screen exits) plus a clearly-labeled simulation mode for device-level demos. Honest by design.",
  },
  {
    icon: Radar,
    title: "Explainable risk engine",
    body: "A rule-based engine combines signals with configurable weights and thresholds — every alert lists its reasons. No black boxes, no ML claims.",
  },
  {
    icon: Eye,
    title: "Human review workflow",
    body: "Alerts are technical detections, never verdicts. Reviewers record decisions and notes with states: new, under review, resolved, inconclusive.",
  },
  {
    icon: BarChart3,
    title: "Results & rankings",
    body: "Backend-evaluated scores, section-wise breakdown, rankings and CSV export. Academic scores stay separate from security indicators.",
  },
  {
    icon: Lock,
    title: "Secure foundations",
    body: "Hashed passwords, role-based access, company data isolation, rate limiting, audit logs and cryptographically hashed invitation tokens.",
  },
];

const STEPS = [
  "Company registers and gets verified by the platform",
  "HR creates an exam and picks a paper pattern",
  "Questions are configured and the exam is published",
  "Candidates receive secure email invitations",
  "Candidates take the exam under server-side timing",
  "Signals are analyzed and explainable alerts raised",
  "HR reviews results and flagged sessions",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2" data-testid="landing-brand">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1220] text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold">ExamGuard</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" data-testid="landing-login-link" className="rounded-lg px-4 py-2 text-sm font-semibold hover:bg-accent">Log in</Link>
          <Link to="/register" data-testid="landing-register-link" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Register company</Link>
        </div>
      </header>

      <section className="hero-grain border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground" data-testid="landing-eyebrow">
              <ScanLine className="h-3.5 w-3.5 text-primary" />
              Detect suspicious behavior, not just suspicious applications
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl" data-testid="landing-headline">
              Smart Online Assessments. <span className="text-primary">Intelligent Security.</span> Trusted Results.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg" data-testid="landing-sub">
              ExamGuard is an examination conducting platform for companies and HR teams — with configurable
              security monitoring, a rule-based behavioral engine and human-reviewed decisions built in.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" data-testid="landing-cta-register" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/login" data-testid="landing-cta-login" className="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-3 text-sm font-semibold hover:bg-accent">
                Company login
              </Link>
            </div>
            <p className="mt-6 max-w-lg text-xs leading-relaxed text-muted-foreground" data-testid="landing-honesty-note">
              ExamGuard records contextual signals for human review. It does not claim to detect every form of
              misconduct, and no single signal is treated as proof — reviewers decide.
            </p>
          </div>
          <div className="relative hidden lg:block">
            <div className="overflow-hidden rounded-2xl border shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1707670467256-895dd77f54ac?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Candidate taking an online examination"
                className="aspect-[4/3] w-full object-cover"
                data-testid="landing-hero-image"
              />
            </div>
            <div className="absolute -bottom-5 -left-5 rounded-xl border bg-card p-4 shadow-lg" data-testid="landing-floating-card">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Radar className="h-4 w-4 text-primary" /> Rule-based risk engine
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Explainable alerts · configurable weights</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl" data-testid="landing-features-title">One platform, three portals</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Dedicated experiences for HR teams, candidates and the platform administrator.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div key={title} data-testid={`landing-feature-${i}`} className="group rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl" data-testid="landing-flow-title">How an assessment runs</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s} data-testid={`landing-step-${i}`} className="rounded-xl border bg-background p-4">
                <span className="font-display text-sm font-bold text-primary">Step {i + 1}</span>
                <p className="mt-1 text-sm text-muted-foreground">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground sm:px-6" data-testid="landing-footer">
          ExamGuard — a final-year B.Tech project demonstration. Technical detections require human review and are not findings of misconduct.
        </div>
      </footer>
    </div>
  );
}
