import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Plus } from "lucide-react";

const TYPE_OPTIONS = [
  { id: "mcq", label: "MCQ" },
  { id: "coding", label: "Coding" },
  { id: "descriptive", label: "Descriptive" },
  { id: "aptitude", label: "Aptitude" },
];

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const empty = () => ({
  title: "",
  jobRole: "",
  description: "",
  instructions: "",
  startAt: toLocalInput(new Date(Date.now() - 3600000).toISOString()),
  endAt: toLocalInput(new Date(Date.now() + 7 * 86400000).toISOString()),
  durationMinutes: 30,
  negativeMarkingEnabled: false,
  defaultNegative: 1,
  questionTypes: [],
  sections: [],
  resultVisibility: "manual",
});

export default function CreateExam({ edit = false }) {
  const navigate = useNavigate();
  const { examId } = useParams();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (edit && examId) {
      http.get(`/exams/${examId}`).then(({ data }) => {
        const e = data.exam;
        setForm({
          title: e.title, jobRole: e.jobRole, description: e.description || "", instructions: e.instructions || "",
          startAt: toLocalInput(e.startAt), endAt: toLocalInput(e.endAt), durationMinutes: e.durationMinutes,
          negativeMarkingEnabled: e.negativeMarking?.enabled || false, defaultNegative: e.negativeMarking?.defaultNegative || 0,
          questionTypes: e.questionTypes || [], sections: e.sections || [], resultVisibility: e.resultVisibility,
        });
      }).catch((err) => toast.error(apiError(err)));
    }
  }, [edit, examId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleType = (id) => {
    setForm((f) => ({
      ...f,
      questionTypes: f.questionTypes.includes(id) ? f.questionTypes.filter((t) => t !== id) : [...f.questionTypes, id],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.questionTypes.length === 0) {
      setError("Select at least one question type (MCQ, Coding, Descriptive or Aptitude).");
      return;
    }
    setBusy(true);
    const payload = {
      title: form.title,
      jobRole: form.jobRole,
      description: form.description,
      instructions: form.instructions,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      durationMinutes: Number(form.durationMinutes),
      questionTypes: form.questionTypes,
      negativeMarking: { enabled: form.negativeMarkingEnabled, defaultNegative: Number(form.defaultNegative) },
      sections: form.sections.filter((s) => s.name),
      resultVisibility: form.resultVisibility,
    };
    try {
      if (edit) {
        await http.put(`/exams/${examId}`, payload);
        toast.success("Examination updated");
        navigate(`/hr/exams/${examId}/questions`);
      } else {
        const { data } = await http.post("/exams", payload);
        toast.success("Examination created — add questions next");
        navigate(`/hr/exams/${data.exam._id}/questions`);
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary";

  return (
    <div className="mx-auto max-w-3xl" data-testid="create-exam-page">
      <PageHead title={edit ? "Edit examination" : "Create examination"} subtitle="Configure the paper pattern, schedule, marking and monitoring for this assessment." />
      <form onSubmit={submit} className="space-y-6" data-testid="create-exam-form">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold">Basics</h2>
          <div>
            <Label htmlFor="title">Examination title *</Label>
            <input id="title" data-testid="exam-title-input" required className={`${inputCls} mt-1.5`} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Full Stack Engineer Assessment" />
          </div>
          <div>
            <Label htmlFor="jobRole">Job role / assessment purpose *</Label>
            <input id="jobRole" data-testid="exam-role-input" required className={`${inputCls} mt-1.5`} value={form.jobRole} onChange={(e) => set("jobRole", e.target.value)} placeholder="Full Stack Developer" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea id="description" data-testid="exam-description-input" rows={2} className={`${inputCls} mt-1.5`} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="instructions">Candidate instructions</Label>
            <textarea id="instructions" data-testid="exam-instructions-input" rows={3} className={`${inputCls} mt-1.5`} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Answer all questions. The timer is controlled by the server…" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold">Paper pattern *</h2>
          <p className="text-xs text-muted-foreground">Select at least one question type. Multiple selections are allowed.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TYPE_OPTIONS.map((t) => (
              <label key={t.id} data-testid={`question-type-${t.id}`} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${form.questionTypes.includes(t.id) ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                <Checkbox checked={form.questionTypes.includes(t.id)} onCheckedChange={() => toggleType(t.id)} data-testid={`question-type-checkbox-${t.id}`} />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold">Schedule &amp; marking</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="startAt">Window opens *</Label>
              <input id="startAt" data-testid="exam-start-input" type="datetime-local" required className={`${inputCls} mt-1.5`} value={form.startAt} onChange={(e) => set("startAt", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="endAt">Window closes *</Label>
              <input id="endAt" data-testid="exam-end-input" type="datetime-local" required className={`${inputCls} mt-1.5`} value={form.endAt} onChange={(e) => set("endAt", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="durationMinutes">Duration (minutes) *</Label>
              <input id="durationMinutes" data-testid="exam-duration-input" type="number" min={5} max={600} required className={`${inputCls} mt-1.5`} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="resultVisibility">Result visibility</Label>
              <select id="resultVisibility" data-testid="exam-visibility-select" className={`${inputCls} mt-1.5`} value={form.resultVisibility} onChange={(e) => set("resultVisibility", e.target.value)}>
                <option value="manual">Manual release (recommended)</option>
                <option value="after_end">Automatically after window closes</option>
                <option value="immediate">Immediately after submission</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch checked={form.negativeMarkingEnabled} onCheckedChange={(v) => set("negativeMarkingEnabled", v)} data-testid="negative-marking-switch" />
            <div className="flex-1">
              <Label>Negative marking</Label>
              <p className="text-xs text-muted-foreground">Deduct marks for wrong MCQ / aptitude answers.</p>
            </div>
            {form.negativeMarkingEnabled && (
              <input type="number" min={0} step="0.5" data-testid="negative-marks-input" className="w-20 rounded-lg border px-2 py-1.5 text-sm" value={form.defaultNegative} onChange={(e) => set("defaultNegative", e.target.value)} />
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-display font-semibold">Sections (optional)</h2>
          <p className="text-xs text-muted-foreground">Group questions into named sections with suggested time limits.</p>
          {form.sections.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input data-testid={`section-name-${i}`} placeholder="Section name" className={`${inputCls} flex-1`} value={s.name} onChange={(e) => set("sections", form.sections.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input data-testid={`section-time-${i}`} type="number" min={1} placeholder="mins" className={`${inputCls} w-28`} value={s.timeLimitMinutes || ""} onChange={(e) => set("sections", form.sections.map((x, j) => (j === i ? { ...x, timeLimitMinutes: Number(e.target.value) } : x)))} />
              <Button type="button" variant="outline" size="icon" data-testid={`section-remove-${i}`} onClick={() => set("sections", form.sections.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" data-testid="add-section-button" onClick={() => set("sections", [...form.sections, { name: "", timeLimitMinutes: 10 }])}><Plus className="h-4 w-4" /> Add section</Button>
        </div>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="create-exam-error">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy} data-testid="create-exam-submit" className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {edit ? "Save changes" : "Create examination"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)} data-testid="create-exam-cancel">Cancel</Button>
        </div>
      </form>
    </div>
  );
}
