import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, Stat, StatusPill, RiskBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Building2, ScrollText, Radar } from "lucide-react";

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const load = useCallback(() => {
    http.get("/admin/overview").then(({ data }) => setOverview(data)).catch((e) => toast.error(apiError(e)));
    http.get("/admin/companies").then(({ data }) => setCompanies(data.companies)).catch((e) => toast.error(apiError(e)));
    http.get("/admin/users").then(({ data }) => setUsers(data.users)).catch((e) => toast.error(apiError(e)));
    http.get("/admin/audit-logs").then(({ data }) => setLogs(data.logs)).catch((e) => toast.error(apiError(e)));
    http.get("/admin/alerts").then(({ data }) => setAlerts(data.alerts)).catch((e) => toast.error(apiError(e)));
  }, []);
  useEffect(load, [load]);

  const setCompanyStatus = async (id, status) => {
    try {
      await http.post(`/admin/companies/${id}/verify`, { status });
      toast.success(status === "verified" ? "Company verified — they can now publish exams" : `Company marked ${status}`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="admin-dashboard">
      <PageHead title="Platform administration" subtitle="Company verification, platform activity and audit trail. Sensitive access is audit-logged." />

      <Tabs defaultValue="overview" data-testid="admin-tabs">
        <TabsList>
          <TabsTrigger value="overview" data-testid="admin-tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="companies" data-testid="admin-tab-companies">Companies</TabsTrigger>
          <TabsTrigger value="users" data-testid="admin-tab-users">Users</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="admin-tab-alerts">Alerts</TabsTrigger>
          <TabsTrigger value="audit" data-testid="admin-tab-audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {!overview ? (
            <p className="py-10 text-center text-sm text-muted-foreground" data-testid="admin-loading">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="admin-overview">
              <Stat label="Companies" value={overview.companies} testid="stat-companies" />
              <Stat label="Pending verification" value={overview.pendingCompanies} testid="stat-pending-companies" />
              <Stat label="Users" value={overview.users} testid="stat-users" />
              <Stat label="Exams (published)" value={`${overview.exams} (${overview.publishedExams})`} testid="stat-exams" />
              <Stat label="Sessions" value={overview.sessions} testid="stat-sessions" />
              <Stat label="Active sessions" value={overview.activeSessions} testid="stat-active-sessions" />
              <Stat label="Alerts (open)" value={`${overview.alerts} (${overview.openAlerts})`} testid="stat-alerts" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="companies" className="mt-6">
          <div className="rounded-xl border bg-card" data-testid="admin-companies-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c._id} data-testid={`company-row-${c.name}`}>
                    <TableCell className="font-medium"><span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{c.name}</span></TableCell>
                    <TableCell className="text-sm">{c.ownerUserId?.email} {c.ownerUserId?.emailVerified ? <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="inline h-3.5 w-3.5 text-amber-500" />}</TableCell>
                    <TableCell><StatusPill status={c.status} /></TableCell>
                    <TableCell className="text-right">
                      {c.status !== "verified" && <Button size="sm" data-testid={`verify-company-${c._id}`} onClick={() => setCompanyStatus(c._id, "verified")}>Verify</Button>}
                      {c.status === "verified" && <Button size="sm" variant="outline" data-testid={`unverify-company-${c._id}`} onClick={() => setCompanyStatus(c._id, "pending")}>Revoke</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <div className="rounded-xl border bg-card" data-testid="admin-users-table">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Company</TableHead><TableHead>Joined</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u._id} data-testid={`user-row-${u.email}`}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>{u.companyId?.name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground" data-testid="admin-alerts-note"><Radar className="h-4 w-4" /> High-level alert overview for abuse investigation. Viewing this page is audit-logged.</p>
          <div className="space-y-2" data-testid="admin-alerts-list">
            {alerts.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No alerts on the platform yet.</p>}
            {alerts.map((a) => (
              <div key={a._id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4" data-testid={`admin-alert-${a._id}`}>
                <RiskBadge level={a.riskLevel} score={a.riskScore} />
                <StatusPill status={a.status} />
                <span className="text-sm font-medium">{a.candidateId?.email}</span>
                <span className="text-xs text-muted-foreground">{a.companyId?.name} · {a.examId?.title} · {new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <div className="rounded-xl border bg-card" data-testid="admin-audit-table">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>IP</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l._id} data-testid={`audit-row-${l._id}`}>
                    <TableCell className="whitespace-nowrap text-xs">{new Date(l.at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{l.actorEmail} <span className="text-muted-foreground">({l.actorRole})</span></TableCell>
                    <TableCell><span className="flex items-center gap-1.5 font-mono text-xs"><ScrollText className="h-3.5 w-3.5" />{l.action}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.targetType || ""} {l.targetId ? String(l.targetId).slice(-6) : ""}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
