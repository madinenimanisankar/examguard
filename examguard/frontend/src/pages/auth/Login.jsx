import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import http, { apiError } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setCompany } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await http.post("/auth/login", form);
      setUser(data.user);
      setCompany(data.company);
      const role = data.user?.role;
      toast.success(`Welcome back, ${data.user?.name || "user"}`);
      if (role === "hr") navigate("/hr");
      else if (role === "admin") navigate("/admin");
      else navigate("/candidate");
    } catch (err) {
      setError(apiError(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10" data-testid="login-page">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2" data-testid="login-brand-link">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1220] text-white"><ShieldCheck className="h-5 w-5" /></span>
          <span className="font-display text-xl font-bold">ExamGuard</span>
        </Link>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold" data-testid="login-title">Log in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Company, candidate and administrator accounts.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="login-form">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input id="email" data-testid="login-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
              <input id="password" data-testid="login-password" type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" placeholder="••••••••" />
            </div>
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="login-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="login-submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
            </button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/forgot-password" data-testid="login-forgot-link" className="text-muted-foreground hover:text-foreground">Forgot password?</Link>
            <Link to="/register" data-testid="login-register-link" className="font-semibold text-primary hover:underline">Register company</Link>
          </div>
          <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" data-testid="login-invite-hint">
            Invited candidate? Open the secure link from your email invitation to register.
          </p>
        </div>
      </div>
    </div>
  );
}
