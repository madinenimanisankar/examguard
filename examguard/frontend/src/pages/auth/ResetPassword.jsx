import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import http, { apiError } from "@/utils/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await http.post("/auth/reset-password", { token, password });
      toast.success("Password updated — log in with your new password");
      navigate("/login");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" data-testid="reset-password-page">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold" data-testid="reset-title">Choose a new password</h1>
        </div>
        {!token ? (
          <p className="text-sm text-destructive" data-testid="reset-missing-token">This link is missing its token. Request a new reset email.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">New password</label>
              <input id="password" data-testid="reset-password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary" placeholder="8+ chars, letter + number" />
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="reset-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="reset-submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
            </button>
          </form>
        )}
        <Link to="/login" className="mt-4 block text-center text-sm font-semibold text-primary hover:underline" data-testid="reset-login-link">Back to login</Link>
      </div>
    </div>
  );
}
