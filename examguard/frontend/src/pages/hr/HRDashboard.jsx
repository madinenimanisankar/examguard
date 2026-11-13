import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { PageHead, Stat, StatusPill, Empty } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Radar, Users, FileText, Mail } from "lucide-react";

export default function HRDashboard() {
  const { user, company } = useAuth();
  const [exams, setExams] = useState(null);

  useEffect(() => {
    http.get("/exams").then(({ data }) => setExams(data.exams)).catch((e) => toast.error(apiError(e)));
  }, []);

  const resendVerification = async () => {
    try {
      const { data } = await http.post("/auth/resend-verification");
      if (data.debugVerifyUrl) window.open(data.debugVerifyUrl, "_self");
      else toast.success(data.message || "Verification email sent");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="hr-dashboard">
      <PageHead
        title="My examinations"
        subtitle={`Welcome back, ${user?.name}. Manage assessments, invitations, monitoring and results.`}
        right={
          <Link to="/hr/exams/new" data-testid="create-exam-button">
            <Button className="gap-2"><Plus className="h-4 w-4" /> Create examination</Button>
          </Link>
        }
      />

      {company?.status !== "verified" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="company-pending-banner">
          <span className="font-semibold">Company verification pending.</span> You can prepare examinations, but publishing requires the platform administrator to verify {company?.name || "your company"}.
          {!user?.emailVerified && (
            <button onClick={resendVerification} data-testid="resend-verification-button" className="ml-2 font-semibold underline">
              Resend verification email
            </button>
          )}
        </div>
      )}

      {!exams ? (
        <p className="py-16 text-center text-sm text-muted-foreground" data-testid="hr-dashboard-loading">Loading examinations…</p>
      ) : exams.length === 0 ? (
        <Empty
          icon={ClipboardList}
          title="No examinations yet"
          hint="Create your first assessment, pick a paper pattern (MCQ, coding, aptitude, descriptive), then invite candidates by email."
          action={<Link to="/hr/exams/new" data-testid="empty-create-exam"><Button className="gap-2"><Plus className="h-4 w-4" /> Create examination</Button></Link>}
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <div key={exam._id} data-testid={`exam-card-${exam._id}`} className="flex flex-col rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-semibold leading-snug" data-testid="exam-card-title">{exam.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{exam.jobRole}</p>
                </div>
                <StatusPill status={exam.status} />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground">
                <div className="rounded-lg bg-muted p-2"><span className="flex items-center justify-center gap-1 font-display text-base font-bold text-foreground"><FileText className="h-3.5 w-3.5" />{exam.questionCount}</span>questions</div>
                <div className="rounded-lg bg-muted p-2"><span className="flex items-center justify-center gap-1 font-display text-base font-bold text-foreground"><Mail className="h-3.5 w-3.5" />{exam.invitationCount}</span>invited</div>
                <div className="rounded-lg bg-muted p-2"><span className="flex items-center justify-center gap-1 font-display text-base font-bold text-foreground"><Users className="h-3.5 w-3.5" />{exam.sessionCount}</span>sessions</div>
                <div className="rounded-lg bg-muted p-2"><span className="flex items-center justify-center gap-1 font-display text-base font-bold text-foreground"><Radar className="h-3.5 w-3.5" />{exam.openAlerts}</span>alerts</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <Link to={`/hr/exams/${exam._id}/questions`} data-testid={`exam-link-questions-${exam._id}`} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Questions</Link>
                <Link to={`/hr/exams/${exam._id}/invitations`} data-testid={`exam-link-invitations-${exam._id}`} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Invitations</Link>
                <Link to={`/hr/exams/${exam._id}/monitor`} data-testid={`exam-link-monitor-${exam._id}`} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Monitor</Link>
                <Link to={`/hr/exams/${exam._id}/results`} data-testid={`exam-link-results-${exam._id}`} className="rounded-lg border px-3 py-1.5 hover:bg-accent">Results</Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{exam.totalMarks} marks · {exam.durationMinutes} min · {exam.questionTypes.join(" + ")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
