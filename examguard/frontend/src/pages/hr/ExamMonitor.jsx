import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill, RiskBadge, Empty } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RefreshCw, FlaskConical, SlidersHorizontal, Save, Loader2 } from "lucide-react";

const SIM_TYPES = [
  { id: "prohibited_app", label: "Prohibited app (e.g. AnyDesk)" },
  { id: "remote_desktop", label: "Remote desktop tool" },
  { id: "screen_share", label: "Screen sharing tool" },
];
const WEIGHT_KEYS = ["tab_hidden", "window_blur", "fullscreen_exit", "copy_attempt", "paste_attempt", "prohibited_app", "remote_desktop", "screen_share"];

export default function ExamMonitor() {
  const { examId } = useParams();
  const [sessions, setSessions] = useState([]);
  const [exam, setExam] = useState(null);
  const [settings, setSettings] = useState(null);
  const [sim, setSim] = useState({ sessionId: "", type: "prohibited_app", processName: "AnyDesk.exe" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    http.get(`/exams/${examId}`).then(({ data }) => {
      setExam(data.exam);
      setSettings({
        fullscreenRequired: data.exam.monitoring?.fullscreenRequired || false,
        simulatorEnabled: data.exam.monitoring?.simulatorEnabled !== false,
        thresholds: { medium: 40, high: 70, critical: 90, ...(data.exam.monitoring?.thresholds || {}) },
        weights: WEIGHT_KEYS.reduce((acc, k) => ({ ...acc, [k]: data.exam.monitoring?.weights?.[k] ?? undefined }), {}),
        prohibitedList: (data.exam.monitoring?.prohibitedList || []).join(", "),
      });
    }).catch((e) => toast.error(apiError(e)));
    http.get(`/security/sessions?examId=${examId}`).then(({ data }) => setSessions(data.sessions)).catch((e) => toast.error(apiError(e)));
  }, [examId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const saveSettings = async () => {
    try {
      await http.put(`/exams/${examId}/monitoring`, {
        monitoring: {
          fullscreenRequired: settings.fullscreenRequired,
          simulatorEnabled: settings.simulatorEnabled,
          thresholds: settings.thresholds,
          weights: settings.weights,
          prohibitedList: settings.prohibitedList.split(",").map((s) => s.trim()).filter(Boolean),
        },
      });
      toast.success("Monitoring rules saved");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const runSimulation = async () => {
    setBusy(true);
    try {
      const { data } = await http.post(`/exams/${examId}/security/simulate`, sim.sessionId ? sim : { type: sim.type, processName: sim.processName });
      toast.success(`${data.message} — risk ${data.riskScore} (${data.level})`, { duration: 6000 });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!exam || !settings) return <p className="py-16 text-center text-sm text-muted-foreground" data-testid="monitor-loading">Loading monitor…</p>;

  return (
    <div data-testid="exam-monitor-page">
      <PageHead title={`Live sessions — ${exam.title}`} subtitle="Candidate exam sessions with server-controlled timers and risk scores. Auto-refreshes every 15s." right={<Button variant="outline" size="sm" onClick={load} data-testid="refresh-sessions-button" className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>} />

      {sessions.length === 0 ? (
        <Empty icon={SlidersHorizontal} title="No exam sessions yet" hint="When candidates start this examination, live sessions appear here." />
      ) : (
        <div className="rounded-xl border bg-card" data-testid="sessions-table-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Server deadline</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s._id} data-testid={`session-row-${s._id}`}>
                  <TableCell>
                    <p className="font-medium">{s.candidate?.name}</p>
                    <p className="text-xs text-muted-foreground">{s.candidate?.email}</p>
                  </TableCell>
                  <TableCell><StatusPill status={s.status} /></TableCell>
                  <TableCell className="text-xs">{new Date(s.startedAt).toLocaleTimeString()}</TableCell>
                  <TableCell className="text-xs">{new Date(s.endsAt).toLocaleTimeString()}</TableCell>
                  <TableCell><RiskBadge level={s.riskScore >= 90 ? "critical" : s.riskScore >= 70 ? "high" : s.riskScore >= 40 ? "medium" : "low"} score={s.riskScore} /></TableCell>
                  <TableCell>{s.alertsCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6" data-testid="simulator-card">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            <h2 className="font-display font-semibold">Demo simulator</h2>
          </div>
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="simulator-disclaimer">
            SIMULATION MODE: these are clearly-labeled demo events, not real device observations. They exist so reviewers can exercise the alert workflow.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Event type</Label>
              <select data-testid="simulator-type-select" className="mt-1.5 w-full rounded-lg border bg-card px-3 py-2 text-sm" value={sim.type} onChange={(e) => setSim((s) => ({ ...s, type: e.target.value }))}>
                {SIM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Session (optional — defaults to most recent active)</Label>
              <select data-testid="simulator-session-select" className="mt-1.5 w-full rounded-lg border bg-card px-3 py-2 text-sm" value={sim.sessionId} onChange={(e) => setSim((s) => ({ ...s, sessionId: e.target.value }))}>
                <option value="">Latest active session</option>
                {sessions.filter((x) => x.status === "active").map((x) => <option key={x._id} value={x._id}>{x.candidate?.email}</option>)}
              </select>
            </div>
            <div>
              <Label>Process name (evidence label)</Label>
              <input data-testid="simulator-process-input" className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm" value={sim.processName} onChange={(e) => setSim((s) => ({ ...s, processName: e.target.value }))} />
            </div>
            <Button onClick={runSimulation} disabled={busy} data-testid="run-simulation-button" className="gap-2">{busy && <Loader2 /> } Inject simulated event</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6" data-testid="rules-card">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold">Rule engine configuration</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Weights are added per recorded event (capped at 5 per type, 15-minute window). Alerts fire at the medium threshold.</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={settings.fullscreenRequired} onCheckedChange={(v) => setSettings((s) => ({ ...s, fullscreenRequired: v }))} data-testid="fullscreen-required-switch" />
              <Label className="flex-1">Require full screen during the exam</Label>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={settings.simulatorEnabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, simulatorEnabled: v }))} data-testid="simulator-enabled-switch" />
              <Label className="flex-1">Enable demo simulator</Label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["medium", "high", "critical"].map((t) => (
                <div key={t}>
                  <Label className="capitalize">{t} threshold</Label>
                  <input type="number" data-testid={`threshold-${t}-input`} className="mt-1.5 w-full rounded-lg border px-2 py-1.5 text-sm" value={settings.thresholds[t]} onChange={(e) => setSettings((s) => ({ ...s, thresholds: { ...s.thresholds, [t]: Number(e.target.value) } }))} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WEIGHT_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate text-muted-foreground" title={k}>{k}</span>
                  <input type="number" min={0} max={100} data-testid={`weight-${k}-input`} className="w-full rounded border px-2 py-1 text-sm" value={settings.weights[k] ?? ""} onChange={(e) => setSettings((s) => ({ ...s, weights: { ...s.weights, [k]: Number(e.target.value) } }))} />
                </label>
              ))}
            </div>
            <div>
              <Label>Prohibited application indicators (comma separated)</Label>
              <input data-testid="prohibited-list-input" className="mt-1.5 w-full rounded-lg border px-3 py-2 font-mono text-xs" value={settings.prohibitedList} onChange={(e) => setSettings((s) => ({ ...s, prohibitedList: e.target.value }))} />
              <p className="mt-1 text-[11px] text-muted-foreground">A match is an indicator for review — never automatic proof of misconduct.</p>
            </div>
            <Button onClick={saveSettings} data-testid="save-rules-button" className="gap-2"><Save className="h-4 w-4" /> Save rules</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
