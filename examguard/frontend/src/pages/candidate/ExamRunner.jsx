import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";
import http, { apiError } from "@/utils/api";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const EXT = { javascript: "js", python: "py" };

export default function ExamRunner() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const offsetRef = useRef(0);
  const dirtyRef = useRef(new Set());
  const lastSentRef = useRef({});

  const report = useCallback((type, meta) => {
    const now = Date.now();
    if (lastSentRef.current[type] && now - lastSentRef.current[type] < 3000) return;
    lastSentRef.current[type] = now;
    if (!session) return;
    http.post("/security/events", { sessionId: session.id, type, meta }).catch(() => {});
  }, [session]);

  const flushDirty = useCallback(() => {
    if (!session) return;
    const ids = [...dirtyRef.current];
    dirtyRef.current.clear();
    ids.forEach((qid) => {
      http.put(`/attempts/session/${session.id}/answers`, { questionId: qid, answer: answers[qid] }).catch(() => dirtyRef.current.add(qid));
    });
  }, [session, answers]);

  // Start (idempotent — resumes an existing session) and clock-skew correction.
  useEffect(() => {
    http.post(`/attempts/${examId}/start`).then(({ data }) => {
      setSession(data.session);
      setExam(data.exam);
      setQuestions(data.questions);
      offsetRef.current = Date.now() - new Date(data.serverNow).getTime();
      setRemaining(new Date(data.session.endsAt).getTime() - (Date.now() - offsetRef.current));
      setLoaded(true);
    }).catch((e) => {
      toast.error(apiError(e));
      navigate("/candidate");
    });
  }, [examId, navigate]);

  // Resume saved answers once session is known.
  useEffect(() => {
    if (!session) return;
    http.get(`/attempts/session/${session.id}`).then(({ data }) => {
      setAnswers((a) => ({ ...data.answers, ...a }));
    }).catch(() => {});
  }, [session]);

  // Timer (server time), autosave loop, browser-event hooks (Layer A).
  useEffect(() => {
    if (!session) return;
    const tick = setInterval(() => {
      const rem = new Date(session.endsAt).getTime() - (Date.now() - offsetRef.current);
      setRemaining(rem);
      if (rem <= 0) clearInterval(tick);
    }, 1000);
    const save = setInterval(flushDirty, 8000);
    const beat = setInterval(() => report("heartbeat"), 30000);
    const onVis = () => { if (document.hidden) { report("tab_hidden"); flushDirty(); } };
    const onBlur = () => report("window_blur");
    const onFs = () => { if (exam?.monitoring?.fullscreenRequired && !document.fullscreenElement) report("fullscreen_exit"); };
    const onBeforeUnload = (e) => { flushDirty(); e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(tick); clearInterval(save); clearInterval(beat);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [session, exam, report, flushDirty]);

  const setAnswer = (qid, patch) => {
    setAnswers((a) => ({ ...a, [qid]: { selected: null, code: "", language: questions.find((q) => q.id === qid)?.problem?.languages?.[0] || "javascript", text: "", ...a[qid], ...patch } }));
    dirtyRef.current.add(qid);
  };

  const q = questions[current];
  const answeredCount = useMemo(() => questions.filter((x) => {
    const a = answers[x.id];
    return a && (a.selected != null || (a.code || "").trim() || (a.text || "").trim());
  }).length, [questions, answers]);
  const mm = String(Math.max(0, Math.floor(remaining / 60000))).padStart(2, "0");
  const ss = String(Math.max(0, Math.floor((remaining % 60000) / 1000))).padStart(2, "0");

  const submit = async () => {
    setSubmitting(true);
    // Persist every dirty answer BEFORE submitting so nothing is lost to a race.
    const dirtyIds = [...dirtyRef.current];
    dirtyRef.current.clear();
    await Promise.allSettled(
      dirtyIds.map((qid) => http.put(`/attempts/session/${session.id}/answers`, { questionId: qid, answer: answers[qid] }))
    );
    try {
      const { data } = await http.post(`/attempts/session/${session.id}/submit`, {});
      navigate("/candidate/submitted", { state: { summary: data.summary, examTitle: exam?.title } });
    } catch (e) {
      toast.error(apiError(e));
      setSubmitting(false);
    }
  };

  if (!loaded || !q) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="runner-loading" /></div>;
  }

  return (
    <div className="min-h-screen bg-background" data-testid="exam-runner">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <p className="truncate font-display font-bold" data-testid="runner-exam-title">{exam.title}</p>
          <div className="flex items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${remaining < 300000 ? "bg-destructive/10 text-destructive" : "bg-muted"}`} data-testid="runner-timer">{mm}:{ss}</span>
            <Button size="sm" onClick={() => { flushDirty(); setConfirmOpen(true); }} data-testid="submit-exam-button">Submit exam</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1fr_220px]">
        <div className="rounded-xl border bg-card p-6" data-testid="runner-question-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question {current + 1} of {questions.length} · {q.type}</p>
            <p className="text-xs text-muted-foreground">{q.marks} marks{q.negativeMarks ? ` · -${q.negativeMarks} if wrong` : ""}</p>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed" data-testid="runner-question-text">{q.text}</p>

          {(q.type === "mcq" || q.type === "aptitude") && (
            <div className="mt-6 space-y-2" data-testid="runner-mcq-options" onPaste={() => report("paste_attempt")} onCopy={() => report("copy_attempt")}>
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  data-testid={`runner-option-${i}`}
                  onClick={() => setAnswer(q.id, { selected: i })}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${answers[q.id]?.selected === i ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent"}`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${answers[q.id]?.selected === i ? "border-primary bg-primary text-primary-foreground" : ""}`}>{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === "coding" && (
            <div className="mt-6 space-y-4">
              {q.problem?.statement && <p className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm" data-testid="runner-problem-statement">{q.problem.statement}</p>}
              {(q.problem?.inputFormat || q.problem?.outputFormat) && (
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  {q.problem?.inputFormat && <p className="rounded border p-2">Input: {q.problem.inputFormat}</p>}
                  {q.problem?.outputFormat && <p className="rounded border p-2">Output: {q.problem.outputFormat}</p>}
                </div>
              )}
              {q.problem?.examples?.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2" data-testid="runner-examples">
                  {q.problem.examples.map((ex, i) => (
                    <div key={i} className="rounded-lg border p-3 font-mono text-xs">
                      <p className="font-semibold text-muted-foreground">Example {i + 1}</p>
                      <p className="mt-1 whitespace-pre-wrap">IN: {ex.input}</p>
                      <p className="whitespace-pre-wrap">OUT: {ex.output}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Language:</label>
                <select data-testid="runner-language-select" value={answers[q.id]?.language || q.problem?.languages?.[0] || "javascript"} onChange={(e) => setAnswer(q.id, { language: e.target.value })} className="rounded-lg border px-2 py-1.5 text-sm">
                  {(q.problem?.languages || ["javascript"]).map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="code-editor-wrapper" data-testid="runner-code-editor">
                <Editor
                  value={answers[q.id]?.code || ""}
                  onValueChange={(code) => setAnswer(q.id, { code })}
                  highlight={(code) => highlight(code, languages[answers[q.id]?.language === "python" ? "python" : "javascript"] || languages.js, answers[q.id]?.language === "python" ? "python" : "javascript")}
                  padding={12}
                  className="code-editor"
                  placeholder="// write your solution here"
                />
              </div>
              <p className="text-xs text-muted-foreground">Hidden test cases run after submission. Time limit per case: {q.problem?.timeLimitSeconds || 5}s.</p>
            </div>
          )}

          {q.type === "descriptive" && (
            <textarea
              rows={10}
              data-testid="runner-descriptive-input"
              className="mt-6 w-full rounded-lg border bg-card p-4 text-sm outline-none focus:ring-2 ring-primary"
              placeholder="Type your answer here…"
              value={answers[q.id]?.text || ""}
              onChange={(e) => setAnswer(q.id, { text: e.target.value })}
            />
          )}

          <div className="mt-6 flex justify-between">
            <Button variant="outline" disabled={current === 0} onClick={() => { flushDirty(); setCurrent((c) => c - 1); }} data-testid="runner-prev-button"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            {current < questions.length - 1 ? (
              <Button onClick={() => { flushDirty(); setCurrent((c) => c + 1); }} data-testid="runner-next-button">Next <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => { flushDirty(); setConfirmOpen(true); }} data-testid="runner-submit-end-button">Submit exam</Button>
            )}
          </div>
        </div>

        <aside className="rounded-xl border bg-card p-4" data-testid="runner-palette">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Question palette</p>
          <div className="mt-3 grid grid-cols-5 gap-2 lg:grid-cols-4">
            {questions.map((x, i) => {
              const a = answers[x.id];
              const answered = a && (a.selected != null || (a.code || "").trim() || (a.text || "").trim());
              return (
                <button
                  key={x.id}
                  data-testid={`palette-question-${i}`}
                  onClick={() => { flushDirty(); setCurrent(i); }}
                  className={`h-9 rounded-lg border text-sm font-semibold transition-colors ${i === current ? "border-primary bg-primary text-primary-foreground" : answered ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "hover:bg-accent"}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground" data-testid="runner-progress">{answeredCount} of {questions.length} answered</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Answers autosave every few seconds. The timer is server-controlled.</p>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle data-testid="submit-confirm-title">Submit your examination?</AlertDialogTitle>
            <AlertDialogDescription>You have answered {answeredCount} of {questions.length} questions. Submission is final — you cannot return.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="submit-cancel-button">Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={submitting} data-testid="submit-confirm-button">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit now"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
