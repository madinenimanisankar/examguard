import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import http, { apiError } from "@/utils/api";
import { PageHead, StatusPill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Link2, Ban, Copy, CheckCheck } from "lucide-react";

const fmt = (d) => (d ? new Date(d).toLocaleString() : "—");

export default function ExamInvitations() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkDialog, setLinkDialog] = useState(null);

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
      if (data.failed.length) toast.error(`${data.failed.length} could not be emailed — use "Copy link" below`, { duration: 8000 });
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

  const resend = async (inv) => {
    try {
      const { data } = await http.post(`/exams/${examId}/invitations/${inv._id}/resend`);
      toast.success(data.message);
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidate email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground" data-testid="no-invitations">No invitations yet.</TableCell></TableRow>
            )}
            {invitations.map((inv) => (
              <TableRow key={inv._id} data-testid={`invitation-row-${inv.email}`}>
                <TableCell className="font-medium">{inv.email}</TableCell>
                <TableCell><StatusPill status={inv.status} /></TableCell>
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
