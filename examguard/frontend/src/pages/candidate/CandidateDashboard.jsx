import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill, Empty, RiskBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, PlayCircle, ClipboardList } from "lucide-react";

const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function CandidateDashboard() {
  const [registrations, setRegistrations] = useState(null);
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    http.get("/attempts/my").then(({ data }) => setRegistrations(data.registrations)).catch((e) => toast.error(apiError(e)));
  }, []);
  useEffect(load, [load]);

  const showResult = async (examId) => {
    try {
      const { data } = await http.get(`/attempts/my-result/${examId}`);
      setResult(data.result);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!registrations) return <p className="py-16 text-center text-sm text-muted-foreground" data-testid="candidate-loading">Loading your examinations…</p>;

  const now = new Date();

  return (
    <div data-testid="candidate-dashboard">
      <PageHead title="My examinations" subtitle="Assessments you have been invited to. Use the same device for the whole exam." />
      {registrations.length === 0 ? (
        <Empty icon={ClipboardList} title="No examinations" hint="When a company invites you, your exam appears here. Open the secure link from your email invitation to register." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {registrations.map((r) => {
            const notOpen = now < new Date(r.exam.startAt);
            const closed = now > new Date(r.exam.endAt);
            return (
              <div key={r.registrationId} className="rounded-xl border bg-card p-6" data-testid={`candidate-exam-card-${r.exam.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold" data-testid="candidate-exam-title">{r.exam.title}</h3>
                    <p className="text-xs text-muted-foreground">{r.exam.jobRole}</p>
                  </div>
                  {r.session?.riskScore > 0 && <RiskBadge level={r.session.riskScore >= 70 ? "high" : "medium"} score={r.session.riskScore} />}
                </div>
                <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                  <p>Window: {fmt(r.exam.startAt)} → {fmt(r.exam.endAt)}</p>
                  <p>Duration: {r.exam.durationMinutes} minutes</p>
                </div>
                <div className="mt-5">
                  {r.session?.status === "submitted" ? (
                    <Button variant="outline" data-testid="view-result-button" onClick={() => showResult(r.exam.id)}>View result</Button>
                  ) : closed ? (
                    <StatusPill status="closed" />
                  ) : notOpen && !r.session ? (
                    <p className="text-sm text-muted-foreground" data-testid="exam-not-open">Opens {fmt(r.exam.startAt)}</p>
                  ) : (
                    <Link to={`/candidate/exam/${r.exam.id}`} data-testid="start-exam-link">
                      <Button className="gap-2" data-testid="start-exam-button">
                        <PlayCircle className="h-4 w-4" /> {r.session ? "Resume examination" : "View instructions & start"}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!result} onOpenChange={(v) => !v && setResult(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle data-testid="result-dialog-title">Your result</DialogTitle></DialogHeader>
          {result && (
            <div className="space-y-3" data-testid="result-dialog">
              <p className="font-display text-4xl font-bold" data-testid="result-total">{result.totalScore} <span className="text-base font-normal text-muted-foreground">/ {result.maxScore}</span></p>
              {result.rank != null && <p className="text-sm text-muted-foreground">Rank: <span className="font-semibold text-foreground">{result.rank}</span> among submitted attempts</p>}
              <p className="text-sm text-muted-foreground">Completed in {result.timeTakenMin} min at {fmt(result.completionTime)}</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {Object.entries(result.perType).map(([t, v]) => (
                  <div key={t} className="rounded-lg bg-muted p-2"><span className="block font-display text-base font-bold">{v}</span>{t}</div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Security-review status is private to the company and is not shown here.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
