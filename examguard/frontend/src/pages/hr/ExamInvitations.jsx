import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Link2, Ban, Copy, CheckCheck, AlertTriangle, RotateCw } from "lucide-react";

const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

const EmailBadge = ({ inv }) => {
  if (!inv.emailStatus) return <span className="text-xs text-muted-foreground" data-testid={`email-status-${inv.email}`}>—</span>;
  const ok = inv.emailStatus === "sent";
  return (
    <div className="max-w-[260px]" data-testid={`email-status-${inv.email}`} title={inv.emailError || "Accepted by the mail server"}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
        {ok ? <CheckCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {ok ? "Sent" : "Failed"}
      </span>
      {!ok && <p className="mt-1 truncate text-xs text-red-700" data-testid={`email-error-${inv.email}`}>{inv.emailError}</p>}
    </div>
  );
};

export default function ExamInvitations() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkDialog, setLinkDialog] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const failedCount = invitations.filter((i) => i.emailStatus === "failed" && !["accepted", "revoked"].includes(i.status)).length;

  const load = useCallback(() => {
    http.get(`/exams/${examId}`).then(({ data }) => setExam(data.exam)).catch((e) => toast.error(apiError(e)));
    http.get(`/exams/${examId}/invitations`).then(({ data }) => setInvitations(data.invitations)).catch((e) => toast.error(apiError(e)));
  }, [examId]);
  useEffect(load, [load]);

  const send = async () => {
    const emails = bulk.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length) {
      toast.error("Paste or type at least one email address");
      return;
    }
    setBusy(true);
    try {
      const { data } = await http.post(`/exams/${examId}/invitations`, { emails });
      toast.success(`${data.sent.length} sent · ${data.skipped.length} skipped (already invited)${data.invalid.length ? ` · ${data.invalid.length} invalid` : ""}`, { duration: 6000 });
      if (data.failed.length) toast.error(`${data.failed.length} could not be emailed (${data.failed[0].reason === "console" ? "no email provider configured — set EMAIL_PROVIDER=smtp in backend/.env" : data.failed[0].reason}) — use "Copy link" below`, { duration: 12000 });
      setBulk("");
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (inv) => {
    try {
      const { data } = await http.post(`/exams/${examId}/invitations/${inv._id}/link`);
      setLinkDialog(data.link);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const resendAllFailed = async () => {
    setRetrying(true);
    try {
      const { data } = await http.post(`/exams/${examId}/invitations/resend-failed`);
      if (data.sent.length) toast.success(`${data.sent.length} of ${data.attempted} resent successfully`);
      if (data.failed.length) toast.error(`${data.failed.length} still failed: ${data.failed[0].reason}`, { duration: 12000 });
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setRetrying(false);
    }
  };

  const resend = async (inv) => {
    try {
      const { data } = await http.post(`/exams/${examId}/invitations/${inv._id}/resend`);
      (data.ok ? toast.success : toast.error)(data.message, { duration: 12000 });
      if (data.link) setLinkDialog(data.link);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const revoke = async (inv) => {
    try {
      await http.post(`/exams/${examId}/invitations/${inv._id}/revoke`);
      toast.success("Invitation revoked");
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="exam-invitations-page">
      <PageHead title={exam ? `Invitations — ${exam.title}` : "Invitations"} subtitle="Send secure, single-use invitation links. Tokens are stored hashed; 'Copy link' mints a fresh token shown once." />
      {exam?.status === "draft" && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="draft-invite-note">
          Publish this examination first — candidates cannot start a draft exam.
        </div>
      )}

      <div className="mb-8 rounded-xl border bg-card p-6" data-testid="invite-compose-card">
        <h2 className="font-display font-semibold">Invite candidates</h2>
        <p className="mt-1 text-xs text-muted-foreground">One email per line (or comma separated). Each candidate gets a personal, expiring registration link.</p>
        <textarea
          rows={4}
          data-testid="invite-emails-input"
          className="mt-3 w-full rounded-lg border bg-card px-3 py-2 font-mono text-sm outline-none focus:ring-2 ring-primary"
          placeholder={"candidate1@example.com\ncandidate2@example.com"}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <Button onClick={send} disabled={busy} data-testid="send-invitations-button" className="mt-3 gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send invitations
        </Button>
      </div>

      <div className="rounded-xl border bg-card" data-testid="invitations-table-card">
        {failedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-red-50 px-4 py-3" data-testid="failed-invitations-bar">
            <p className="text-sm text-red-800" data-testid="failed-invitations-count">{failedCount} invitation email{failedCount > 1 ? "s" : ""} failed to send.</p>
            <Button size="sm" variant="outline" onClick={resendAllFailed} disabled={retrying} data-testid="resend-all-failed-button" className="gap-2">
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} Resend all failed
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground" data-testid="no-invitations">No invitations yet.</TableCell></TableRow>
            )}
            {invitations.map((inv) => (
              <TableRow key={inv._id} data-testid={`invitation-row-${inv.email}`}>
                <TableCell className="font-medium">{inv.email}</TableCell>
                <TableCell><StatusPill status={inv.status} /></TableCell>
                <TableCell><EmailBadge inv={inv} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmt(inv.sentAt)}{inv.timesSent > 1 ? ` · ${inv.timesSent}×` : ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmt(inv.expiresAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {!["accepted", "revoked"].includes(inv.status) && (
                      <Button variant="ghost" size="sm" data-testid={`copy-link-${inv.email}`} onClick={() => copyLink(inv)} title="Mint a fresh secure link"><Link2 className="h-4 w-4" /></Button>
                    )}
                    {!["accepted", "revoked", "expired"].includes(inv.status) && (
                      <Button variant="ghost" size="sm" data-testid={`resend-${inv.email}`} onClick={() => resend(inv)} title="Resend email"><Mail className="h-4 w-4" /></Button>
                    )}
                    {!["accepted", "revoked"].includes(inv.status) && (
                      <Button variant="ghost" size="sm" data-testid={`revoke-${inv.email}`} onClick={() => revoke(inv)} title="Revoke"><Ban className="h-4 w-4" /></Button>
                    )}
                    {inv.status === "accepted" && <CheckCheck className="h-4 w-4 text-emerald-500" />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!linkDialog} onOpenChange={(v) => !v && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Secure invitation link</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">This single-use link is shown only once (tokens are stored hashed). Share it with the candidate if email is unavailable.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs" data-testid="invitation-link-code">{linkDialog}</code>
            <Button size="sm" variant="outline" data-testid="copy-invitation-link-button" onClick={() => { navigator.clipboard.writeText(linkDialog); toast.success("Copied"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
