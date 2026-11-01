import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import http, { apiError } from "@/utils/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await http.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" data-testid="forgot-password-page">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold" data-testid="forgot-title">Reset your password</h1>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground" data-testid="forgot-sent">If that email is registered, a reset link has been sent. Check your inbox.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input id="email" data-testid="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary" />
            </div>
            <button type="submit" disabled={busy} data-testid="forgot-submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
            </button>
          </form>
        )}
        <Link to="/login" className="mt-4 block text-center text-sm font-semibold text-primary hover:underline" data-testid="forgot-login-link">Back to login</Link>
      </div>
    </div>
  );
}
