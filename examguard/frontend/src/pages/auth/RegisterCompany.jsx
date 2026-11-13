import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import http, { apiError } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";

const Field = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
    <input id={id} data-testid={id} className="w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2" {...props} />
  </div>
);

export default function RegisterCompany() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ companyName: "", hrName: "", email: "", password: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await http.post("/auth/company/register", form);
      setUser(data.user);
      if (data.debugVerifyUrl) toast.info("Email sending is in console mode — verify via the banner in your dashboard.");
      else toast.success("Verification email sent. Check your inbox.");
      navigate("/hr");
    } catch (err) {
      setError(apiError(err, "Registration failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10" data-testid="register-page">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2" data-testid="register-brand-link">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1220] text-white"><ShieldCheck className="h-5 w-5" /></span>
          <span className="font-display text-xl font-bold">ExamGuard</span>
        </Link>
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold" data-testid="register-title">Register your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create an HR account to start building assessments.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="register-form">
            <Field label="Company name" id="companyName" required value={form.companyName} onChange={set("companyName")} placeholder="Acme Technologies" />
            <Field label="HR representative's name" id="hrName" required value={form.hrName} onChange={set("hrName")} placeholder="Aarti Sharma" />
            <Field label="Official email address" id="email" type="email" required value={form.email} onChange={set("email")} placeholder="hr@acme.com" />
            <Field label="Password" id="password" type="password" required value={form.password} onChange={set("password")} placeholder="8+ chars, letter + number" />
            <Field label="Company website (optional)" id="website" value={form.website} onChange={set("website")} placeholder="https://acme.com" />
            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="register-error">{error}</p>}
            <button type="submit" disabled={busy} data-testid="register-submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create company account
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already registered? <Link to="/login" data-testid="register-login-link" className="font-semibold text-primary hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
