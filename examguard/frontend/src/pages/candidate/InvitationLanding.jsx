import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { StatusPill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, CalendarClock, Timer, FileText } from "lucide-react";

const fmt = (d) => new Date(d).toLocaleString();

export default function InvitationLanding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", password: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    http.get(`/invitations/lookup/${token}`).then(({ data }) => setData(data)).catch((e) => setError(apiError(e, "This invitation link is invalid")));
  }, [token]);

  const register = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await http.post("/auth/candidate/register", { invitationToken: token, ...form });
      const me = await http.get("/auth/me");
      setUser(me.data.user);
      toast.success("Registered — good luck!");
      navigate("/candidate");
    } catch (err) {
      if (err?.response?.data?.code === "ACCOUNT_EXISTS") {
        toast.info("Account exists — log in, then reopen this invitation link to accept it.");
        navigate("/login");
      } else {
        toast.error(apiError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    try {
      await http.post("/auth/candidate/accept-invitation", { invitationToken: token });
      toast.success("Invitation accepted");
      navigate("/candidate");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4" data-testid="invitation-error-page">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-bold" data-testid="invitation-error-title">Invitation problem</h1>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="invitation-error-message">{error}</p>
          <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline" data-testid="invitation-error-login-link">Go to login</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="invitation-loading" /></div>;
  }

  const { exam, companyName, invitation } = data;
  const invitable = ["pending", "sent"].includes(invitation.status);
  const isInvitee = user?.email && invitation.maskedEmail && user.email[0] === invitation.maskedEmail[0];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10" data-testid="invitation-landing-page">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B1220] text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="font-display text-lg font-bold">ExamGuard</span>
          </div>
          <StatusPill status={invitation.status} />
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold" data-testid="invitation-exam-title">{exam.title}</h1>
        <p className="text-sm text-muted-foreground">{companyName} · {exam.jobRole}</p>

        <div className="mt-5 space-y-2 rounded-xl bg-muted p-4 text-sm" data-testid="invitation-details">
          <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> {fmt(exam.startAt)} → {fmt(exam.endAt)}</p>
          <p className="flex items-center gap-2"><Timer className="h-4 w-4" /> {exam.durationMinutes} minutes · {exam.questionTypes.join(", ")}</p>
          <p className="flex items-center gap-2"><FileText className="h-4 w-4" /> {exam.negativeMarking?.enabled ? `Negative marking: -${exam.negativeMarking.defaultNegative} per wrong MCQ` : "No negative marking"}</p>
        </div>
        {exam.instructions && <p className="mt-4 whitespace-pre-wrap rounded-xl border p-4 text-sm text-muted-foreground" data-testid="invitation-instructions">{exam.instructions}</p>}
        <p className="mt-3 text-xs text-muted-foreground" data-testid="invitation-privacy-note">
          Invited email: {invitation.maskedEmail}. Activity inside the exam (tab switches, focus loss) may be recorded as contextual security signals for the company's review.
        </p>

        {invitation.status === "accepted" && (
          <div className="mt-6">
            <p className="text-sm text-emerald-700" data-testid="invitation-accepted-note">You are registered for this examination.</p>
            <Link to="/candidate" data-testid="invitation-to-dashboard"><Button className="mt-3 w-full">Go to my dashboard</Button></Link>
          </div>
        )}
        {invitable && user?.role === "candidate" && (
          <Button className="mt-6 w-full" onClick={accept} disabled={busy} data-testid="accept-invitation-button">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Accept invitation as {user.email}</Button>
        )}
        {invitable && !user && (
          <form onSubmit={register} className="mt-6 space-y-4" data-testid="invitation-register-form">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Your full name</label>
              <input id="name" data-testid="invitation-name-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Choose a password</label>
              <input id="password" data-testid="invitation-password-input" type="password" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="8+ chars, letter + number" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary" />
            </div>
            <Button type="submit" className="w-full" disabled={busy} data-testid="invitation-register-button">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Register with this invitation</Button>
          </form>
        )}
        {invitable && user && user.role !== "candidate" && (
          <p className="mt-6 text-sm text-muted-foreground" data-testid="invitation-wrong-role">You are logged in as {user.role}. Log in with the invited candidate account to accept.</p>
        )}
        {!invitable && invitation.status !== "accepted" && (
          <p className="mt-6 text-sm text-destructive" data-testid="invitation-closed">This invitation is {invitation.status}.</p>
        )}
      </div>
    </div>
  );
}
