import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export function FullLoader({ label = "Loading…" }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" data-testid="page-loader">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}
