import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import http, { apiError } from "@/utils/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState(token ? "working" : "missing"); // working | ok | error | missing

  useEffect(() => {
    if (!token) return;
    http
      .post("/auth/company/verify-email", { token })
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        console.error(apiError(e));
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" data-testid="verify-email-page">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        {state === "working" && (
          <div className="flex flex-col items-center gap-3" data-testid="verify-working">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying your email…</p>
          </div>
        )}
        {state === "ok" && (
          <div className="flex flex-col items-center gap-3" data-testid="verify-ok">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <h1 className="font-display text-xl font-bold">Email verified</h1>
            <p className="text-sm text-muted-foreground">Your account is confirmed. The platform administrator still needs to verify your company before you can publish exams.</p>
            <Link to="/hr" data-testid="verify-to-dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Go to dashboard</Link>
          </div>
        )}
        {(state === "error" || state === "missing") && (
          <div className="flex flex-col items-center gap-3" data-testid="verify-error">
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="font-display text-xl font-bold">Verification failed</h1>
            <p className="text-sm text-muted-foreground">{state === "missing" ? "No token found in this link." : "This verification link is invalid or has expired."}</p>
            <Link to="/hr" data-testid="verify-to-dashboard-fallback" className="rounded-lg border px-4 py-2 text-sm font-semibold">Go to dashboard</Link>
          </div>
        )}
      </div>
    </div>
  );
}
