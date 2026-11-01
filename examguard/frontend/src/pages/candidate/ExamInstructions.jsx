import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { ClipboardList, Timer, ShieldAlert, PlayCircle } from "lucide-react";

export default function ExamInstructions() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [reg, setReg] = useState(null);

  useEffect(() => {
    http.get("/attempts/my").then(({ data }) => {
      const found = data.registrations.find((r) => r.exam.id === examId);
      if (!found) navigate("/candidate");
      else setReg(found);
    }).catch((e) => toast.error(apiError(e)));
  }, [examId, navigate]);

  if (!reg) return <p className="py-16 text-center text-sm text-muted-foreground" data-testid="instructions-loading">Loading…</p>;

  const exam = reg.exam;

  return (
    <div className="mx-auto max-w-2xl" data-testid="exam-instructions-page">
      <PageHead title={exam.title} subtitle={`${exam.jobRole} — please read the instructions carefully before starting.`} right={<StatusPill status={exam.status} />} />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 text-center" data-testid="instruction-duration">
            <Timer className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 font-display text-lg font-bold">{exam.durationMinutes} min</p>
            <p className="text-xs text-muted-foreground">server-controlled timer</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center" data-testid="instruction-window">
            <ClipboardList className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xs">Window closes {new Date(exam.endAt).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center col-span-2" data-testid="instruction-security">
            <ShieldAlert className="mx-auto h-5 w-5 text-amber-500" />
            <p className="mt-1 text-xs text-muted-foreground">Tab switches and focus loss are recorded as contextual signals and reviewed by the company.</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 text-sm leading-relaxed" data-testid="instructions-body">
          <h2 className="font-display font-semibold">Instructions</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>The timer starts when you press Start and is controlled by the server — refreshing will not pause it.</li>
            <li>Answers autosave; if you are disconnected, reopen the exam and resume.</li>
            <li>You can submit only once. Unanswered questions score zero.</li>
            <li>Do not leave the exam tab. Use one device for the entire exam.</li>
          </ul>
        </div>

        <Link to={`/candidate/exam/${examId}/run`} data-testid="instructions-start-link">
          <Button size="lg" className="w-full gap-2" data-testid="instructions-start-button">
            <PlayCircle className="h-5 w-5" /> {reg.session ? "Resume examination" : "Start examination"}
          </Button>
        </Link>
      </div>
    </div>
  );
}
