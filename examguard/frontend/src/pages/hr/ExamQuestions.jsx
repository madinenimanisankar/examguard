import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill, Empty } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Plus, ArrowUp, ArrowDown, Pencil, Rocket, Lock } from "lucide-react";

const LANGS = [
  { id: "javascript", label: "JavaScript (Node.js)" },
  { id: "python", label: "Python" },
];

function QuestionForm({ examId, type, question, onDone }) {
  const [f, setF] = useState(
    question || {
      text: "", marks: 5, negativeMarks: 0, options: ["", "", "", ""], correctIndex: 0,
      problem: { statement: "", inputFormat: "", outputFormat: "", constraints: "", examples: [{ input: "", output: "" }], languages: ["javascript"], timeLimitSeconds: 5 },
      testCases: [{ input: "", output: "" }], modelAnswer: "",
    }
  );
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setP = (k, v) => setF((x) => ({ ...x, problem: { ...x.problem, [k]: v } }));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { type, ...f, options: (f.options || []).map((o) => String(o).trim()).filter(Boolean) };
      if (question) await http.put(`/exams/${examId}/questions/${question._id}`, payload);
      else await http.post(`/exams/${examId}/questions`, payload);
      toast.success(question ? "Question updated" : "Question added");
      onDone(true);
    } catch (e) {
      toast.error(apiError(e));
      onDone(false);
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 ring-primary";
  return (
    <div className="space-y-4" data-testid="question-form">
      <div>
        <Label>Question text *</Label>
        <textarea data-testid="question-text-input" rows={3} className={`${inputCls} mt-1.5`} value={f.text} onChange={(e) => set("text", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Marks *</Label>
          <input data-testid="question-marks-input" type="number" min={1} max={100} className={`${inputCls} mt-1.5`} value={f.marks} onChange={(e) => set("marks", e.target.value)} />
        </div>
        <div>
          <Label>Negative marks</Label>
          <input data-testid="question-negative-input" type="number" min={0} className={`${inputCls} mt-1.5`} value={f.negativeMarks || 0} onChange={(e) => set("negativeMarks", e.target.value)} />
        </div>
      </div>

      {(type === "mcq" || type === "aptitude") && (
        <div>
          <Label>Answer options * (mark the correct one)</Label>
          <RadioGroup value={String(f.correctIndex)} onValueChange={(v) => set("correctIndex", Number(v))} className="mt-2 space-y-2" data-testid="mcq-options-group">
            {f.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <RadioGroupItem value={String(i)} data-testid={`correct-option-radio-${i}`} />
                <input data-testid={`option-input-${i}`} placeholder={`Option ${i + 1}`} className={inputCls} value={opt} onChange={(e) => set("options", f.options.map((o, j) => (j === i ? e.target.value : o)))} />
                {f.options.length > 2 && <Button variant="ghost" size="icon" data-testid={`option-remove-${i}`} onClick={() => set("options", f.options.filter((_, j) => j !== i))}>×</Button>}
              </div>
            ))}
          </RadioGroup>
          {f.options.length < 6 && <Button variant="outline" size="sm" className="mt-2" data-testid="add-option-button" onClick={() => set("options", [...f.options, ""])}>+ Add option</Button>}
        </div>
      )}

      {type === "coding" && (
        <>
          <div>
            <Label>Problem statement *</Label>
            <textarea data-testid="problem-statement-input" rows={4} className={`${inputCls} mt-1.5`} value={f.problem?.statement || ""} onChange={(e) => setP("statement", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Input format</Label><input data-testid="problem-input-format" className={`${inputCls} mt-1.5`} value={f.problem?.inputFormat || ""} onChange={(e) => setP("inputFormat", e.target.value)} /></div>
            <div><Label>Output format</Label><input data-testid="problem-output-format" className={`${inputCls} mt-1.5`} value={f.problem?.outputFormat || ""} onChange={(e) => setP("outputFormat", e.target.value)} /></div>
          </div>
          <div><Label>Constraints</Label><input data-testid="problem-constraints" className={`${inputCls}`} value={f.problem?.constraints || ""} onChange={(e) => setP("constraints", e.target.value)} /></div>
          <div>
            <Label>Example(s) *</Label>
            {f.problem?.examples?.map((ex, i) => (
              <div key={i} className="mt-2 grid grid-cols-2 gap-2">
                <input data-testid={`example-input-${i}`} placeholder="Example stdin" className={inputCls} value={ex.input} onChange={(e) => setP("examples", f.problem.examples.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))} />
                <input data-testid={`example-output-${i}`} placeholder="Expected stdout" className={inputCls} value={ex.output} onChange={(e) => setP("examples", f.problem.examples.map((x, j) => (j === i ? { ...x, output: e.target.value } : x)))} />
              </div>
            ))}
          </div>
          <div>
            <Label>Languages *</Label>
            <div className="mt-2 flex gap-4">
              {LANGS.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(f.problem?.languages || []).includes(l.id)} onCheckedChange={(v) => setP("languages", v ? [...new Set([...(f.problem?.languages || []), l.id])] : (f.problem?.languages || []).filter((x) => x !== l.id))} data-testid={`language-checkbox-${l.id}`} />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Hidden test cases * (candidates never see these)</Label>
            {f.testCases?.map((tc, i) => (
              <div key={i} className="mt-2 grid grid-cols-2 gap-2">
                <input data-testid={`testcase-input-${i}`} placeholder="Test stdin" className={inputCls} value={tc.input} onChange={(e) => set("testCases", f.testCases.map((x, j) => (j === i ? { ...x, input: e.target.value } : x)))} />
                <input data-testid={`testcase-output-${i}`} placeholder="Expected stdout" className={inputCls} value={tc.output} onChange={(e) => set("testCases", f.testCases.map((x, j) => (j === i ? { ...x, output: e.target.value } : x)))} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-2" data-testid="add-testcase-button" onClick={() => set("testCases", [...(f.testCases || []), { input: "", output: "" }])}>+ Add test case</Button>
          </div>
        </>
      )}

      {type === "descriptive" && (
        <div>
          <Label>Model answer (visible to reviewers only)</Label>
          <textarea data-testid="model-answer-input" rows={3} className={`${inputCls} mt-1.5`} value={f.modelAnswer || ""} onChange={(e) => set("modelAnswer", e.target.value)} />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button onClick={save} disabled={busy} data-testid="question-save-button" className="gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {question ? "Save question" : "Add question"}</Button>
        <Button variant="outline" onClick={() => onDone(false)} data-testid="question-cancel-button">Cancel</Button>
      </div>
    </div>
  );
}

export default function ExamQuestions() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { type, question }
  const [activeTab, setActiveTab] = useState(null);

  const load = useCallback(() => {
    http.get(`/exams/${examId}`).then(({ data }) => setExam(data.exam)).catch((e) => toast.error(apiError(e)));
    http.get(`/exams/${examId}/questions`).then(({ data }) => setQuestions(data.questions)).catch((e) => toast.error(apiError(e)));
  }, [examId]);
  useEffect(load, [load]);

  if (!exam) return <p className="py-16 text-center text-sm text-muted-foreground" data-testid="questions-loading">Loading examination…</p>;

  const canEdit = exam.status === "draft" || questions.every(() => true);
  const editable = exam.status !== "closed";
  const locked = exam.status === "published";

  const publish = async () => {
    try {
      await http.post(`/exams/${examId}/publish`);
      toast.success("Examination published — you can now invite candidates");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const remove = async (id) => {
    try {
      await http.delete(`/exams/${examId}/questions/${id}`);
      toast.success("Question removed");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const move = async (index, dir) => {
    const ids = questions.map((q) => q._id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    try {
      await http.put(`/exams/${examId}/questions/reorder`, { orderedIds: ids });
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const openEditor = (type, question = null) => {
    if (locked) {
      toast.error("This examination is published — editing is locked to protect the paper.");
      return;
    }
    setEditing({ type, question });
    setDialogOpen(true);
  };

  const types = exam.questionTypes;
  const questionsFor = (t) => questions.filter((q) => q.type === t);

  return (
    <div data-testid="exam-questions-page">
      <PageHead
        title={exam.title}
        subtitle={`${exam.jobRole} · ${exam.totalMarks} marks · ${exam.durationMinutes} min · pattern: ${types.join(", ")}`}
        right={
          <div className="flex items-center gap-3">
            <StatusPill status={exam.status} />
            {exam.status === "draft" && (
              <Button onClick={publish} data-testid="publish-exam-button" className="gap-2"><Rocket className="h-4 w-4" /> Publish</Button>
            )}
            {exam.status === "published" && (
              <Button variant="outline" onClick={() => navigate(`/hr/exams/${examId}/invitations`)} data-testid="go-invite-button">Invite candidates</Button>
            )}
          </div>
        }
      />
      {locked && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" data-testid="published-lock-note">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          This examination is published. Questions are read-only to protect the paper once candidates start.
        </div>
      )}

      <Tabs value={activeTab || types[0]} onValueChange={setActiveTab} data-testid="question-type-tabs">
        <TabsList>
          {types.map((t) => (
            <TabsTrigger key={t} value={t} data-testid={`tab-${t}`}>
              {t.toUpperCase()} ({questionsFor(t).length})
            </TabsTrigger>
          ))}
        </TabsList>
        {types.map((t) => (
          <TabsContent key={t} value={t} className="mt-6">
            <div className="mb-4 flex justify-end">
              <Button onClick={() => openEditor(t)} data-testid={`add-question-${t}`} className="gap-2"><Plus className="h-4 w-4" /> Add {t} question</Button>
            </div>
            {questionsFor(t).length === 0 ? (
              <Empty title={`No ${t} questions yet`} hint={`Add at least one ${t} question — publishing requires every selected type to have a question.`} />
            ) : (
              <div className="space-y-3">
                {questionsFor(t).map((q, i) => (
                  <div key={q._id} data-testid={`question-card-${q._id}`} className="rounded-xl border bg-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{i + 1}. {q.text}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {q.marks} marks{q.negativeMarks ? ` · -${q.negativeMarks} negative` : ""} · {q.options ? `${q.options.length} options` : ""}{q.testCases ? `${q.testCases.length} hidden test case(s)` : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" data-testid={`question-up-${q._id}`} onClick={() => move(questions.indexOf(q), -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" data-testid={`question-down-${q._id}`} onClick={() => move(questions.indexOf(q), 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" data-testid={`question-edit-${q._id}`} onClick={() => openEditor(q.type, q)}><Pencil className="h-4 w-4" /></Button>
                        {!locked && <Button variant="ghost" size="icon" data-testid={`question-delete-${q._id}`} onClick={() => remove(q._id)}>×</Button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="question-dialog-title">{editing?.question ? "Edit" : "Add"} {editing?.type} question</DialogTitle>
          </DialogHeader>
          {editing && <QuestionForm examId={examId} type={editing.type} question={editing.question} onDone={(saved) => { setDialogOpen(false); if (saved) load(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
