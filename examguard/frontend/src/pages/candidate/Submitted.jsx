import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Submitted() {
  const { state } = useLocation();
  const summary = state?.summary;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4" data-testid="submitted-page">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 font-display text-2xl font-bold" data-testid="submitted-title">Examination submitted</h1>
        {state?.examTitle && <p className="mt-1 text-sm text-muted-foreground">{state.examTitle}</p>}
        {summary && (
          <div className="mt-5 space-y-1 rounded-xl bg-muted p-4 text-sm" data-testid="submitted-summary">
            <p>Auto-evaluated score so far: <span className="font-semibold">{summary.autoScore}</span></p>
            {summary.pendingReview > 0 && <p className="text-amber-700">{summary.pendingReview} descriptive answer(s) await manual review.</p>}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground" data-testid="submitted-note">
          Your company will release results according to its result-visibility setting. Security signals from your session may be reviewed by a human before decisions.
        </p>
        <Link to="/candidate" data-testid="submitted-to-dashboard">
          <Button className="mt-6 gap-2" variant="outline"><ClipboardList className="h-4 w-4" /> Back to my examinations</Button>
        </Link>
      </div>
    </div>
  );
}
