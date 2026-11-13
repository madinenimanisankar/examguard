import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill, Empty, Stat } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Download, Megaphone, PenLine } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function ExamResults() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null); // session detail for manual scoring

  const load = useCallback(() => {
    http.get(`/exams/${examId}`).then(({ data }) => setExam(data.exam)).catch((e) => toast.error(apiError(e)));
    http.get(`/results/exams/${examId}`).then(({ data }) => { setExam(data.exam); setRows(data.rows); }).catch((e) => toast.error(apiError(e)));
  }, [examId]);
  useEffect(load, [load]);

  const openSession = async (sessionId) => {
    try {
      const { data } = await http.get(`/results/sessions/${sessionId}`);
      setDetail(data);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const score = async (submissionId, marks) => {
    const raw = window.prompt(`Score for this descriptive answer (0 - ${marks}):`, "0");
    if (raw == null) return;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > marks) {
      toast.error(`Score must be between 0 and ${marks}`);
      return;
    }
    try {
      await http.put(`/results/submissions/${submissionId}`, { score: value, feedback: "Manually reviewed" });
      toast.success("Score saved");
      if (detail) openSession(detail.session._id);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const release = async () => {
    try {
      await http.put(`/results/exams/${examId}/release`);
      toast.success("Results released to candidates");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!exam) return <p className="py-16 text-center text-sm text-muted-foreground" data-testid="results-loading">Loading results…</p>;

  const submitted = rows.filter((r) => r.status === "submitted");

  return (
    <div data-testid="exam-results-page">
      <PageHead
        title={`Results — ${exam.title}`}
        subtitle="Scores are computed by the backend. Academic scores and security-review indicators are kept separate."
        right={
          <div className="flex gap-2">
            <a href={`${BACKEND}/api/results/exams/${examId}/csv`} data-testid="download-csv-button">
              <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
            </a>
            {exam.resultVisibility === "manual" && !exam.resultsReleased && (
              <Button onClick={release} data-testid="release-results-button" className="gap-2"><Megaphone className="h-4 w-4" /> Release results</Button>
            )}
          </div>
        }
      />

      {exam.resultVisibility === "manual" && (
        <p className="mb-6 text-xs text-muted-foreground" data-testid="visibility-note">
          Result visibility: manual release {exam.resultsReleased ? "(released)" : "(not yet released to candidates)"}.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total marks" value={exam.totalMarks} testid="stat-total-marks" />
        <Stat label="Completed" value={submitted.length} testid="stat-completed" />
        <Stat label="Sessions" value={rows.length} testid="stat-sessions" />
        <Stat label="Awaiting review" value={rows.reduce((a, r) => a + r.pendingManual, 0)} testid="stat-pending" />
      </div>

      {rows.length === 0 ? (
        <Empty title="No attempts yet" hint="Results appear here once candidates register and take the examination." />
      ) : (
        <div className="rounded-xl border bg-card" data-testid="results-table-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>MCQ / Coding / Desc. / Apt.</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Security review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.sessionId)} data-testid={`result-row-${r.email}`} className="cursor-pointer" onClick={() => openSession(r.sessionId)}>
                  <TableCell className="font-display font-bold">{r.rank ?? "—"}</TableCell>
                  <TableCell>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </TableCell>
                  <TableCell className="font-semibold">{r.totalScore} <span className="text-xs font-normal text-muted-foreground">/ {r.maxScore}</span></TableCell>
                  <TableCell className="text-xs">{r.breakdown.mcq || 0} / {r.breakdown.coding || 0} / {r.breakdown.descriptive || 0} / {r.breakdown.aptitude || 0}</TableCell>
                  <TableCell className="text-xs">{r.timeTakenMin != null ? `${r.timeTakenMin} min` : "—"}</TableCell>
                  <TableCell><StatusPill status={r.status} /></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}><StatusPill status={r.securityStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle data-testid="session-detail-title">Attempt — {detail?.candidate?.email}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4" data-testid="session-detail">
              {detail.submissions.length === 0 && <p className="text-sm text-muted-foreground">No answers were saved for this session.</p>}
              {detail.submissions.map((s) => (
                <div key={s.id} className="rounded-lg border p-4" data-testid={`submission-${s.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{s.question?.text}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.question?.type} · {s.question?.marks} marks</p>
                    </div>
                    <span className="font-display text-lg font-bold" data-testid="submission-score">{s.score} / {s.question?.marks}</span>
                  </div>
                  {s.question?.type === "descriptive" && (
                    <>
                      <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-3 text-sm" data-testid="descriptive-answer">{s.answer?.text || "(no answer)"}</p>
                      {s.question?.modelAnswer && <p className="mt-2 text-xs text-muted-foreground">Model answer: {s.question.modelAnswer}</p>}
                      {s.status === "pending_review" && (
                        <Button size="sm" variant="outline" className="mt-2 gap-2" data-testid="score-descriptive-button" onClick={() => score(s.id, s.question.marks)}>
                          <PenLine className="h-4 w-4" /> Score this answer
                        </Button>
                      )}
                    </>
                  )}
                  {s.question?.type === "coding" && (
                    <>
                      <pre className="mt-2 overflow-x-auto rounded bg-[#0B1220] p-3 text-xs text-slate-100" data-testid="coding-answer">{s.answer?.code || "(no code)"}</pre>
                      <p className="mt-1 text-xs text-muted-foreground">{s.autoFeedback}</p>
                    </>
                  )}
                  {(s.question?.type === "mcq" || s.question?.type === "aptitude") && (
                    <p className="mt-2 text-sm">Selected: {s.answer?.selected != null ? s.question?.options?.[s.answer.selected] : "(not answered)"} · {s.autoFeedback}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
