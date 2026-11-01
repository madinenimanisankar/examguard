import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, LogOut, LayoutDashboard, Radar, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout() {
  const { user, setUser, company } = useAuth();
  const navigate = useNavigate();

  const links =
    user?.role === "admin"
      ? [{ to: "/admin", label: "Platform Admin", icon: Settings2 }]
      : [
          { to: "/hr", label: "My Exams", icon: LayoutDashboard },
          { to: "/alerts", label: "Security Alerts", icon: Radar },
        ];

  const logout = async () => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    setUser(null);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background" data-testid="app-shell">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to={user?.role === "admin" ? "/admin" : "/hr"} className="flex items-center gap-2" data-testid="brand-link">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B1220] text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">ExamGuard</span>
          </Link>
          <nav className="ml-4 flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={({ isActive }) =>
                  cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user?.role === "hr" && company && (
              <span className="hidden text-xs text-muted-foreground sm:block" data-testid="header-company">
                {company.name} · <span className="font-medium capitalize">{company.status}</span>
              </span>
            )}
            <span className="hidden max-w-[180px] truncate text-sm text-muted-foreground sm:block" data-testid="header-user">{user?.email}</span>
            <button onClick={logout} data-testid="logout-button" className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
