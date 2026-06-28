import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, HardHat, Settings, LogOut, Building2, BarChart2, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "@/components/NotificationBell";
import type { ReactNode } from "react";

const allNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gestor"] as const },
  { to: "/minhas-obras", label: "As minhas obras", icon: HardHat, roles: ["encarregado", "admin"] as const },
  { to: "/relatorios", label: "Relatórios", icon: BarChart2, roles: ["admin", "gestor"] as const },
  { to: "/gestao", label: "Gestão", icon: Settings, roles: ["admin"] as const, hasSubpages: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, nome, signOut } = useAuth();
  const path = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();
  const nav = allNav.filter(n => role && n.roles.includes(role as never));

  const isActive = (to: string) => to === "/" ? path === "/" : to === "/gestao" ? path === "/gestao" : path.startsWith(to);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="p-5 border-b border-sidebar-border">
          <div className="text-2xl font-bold tracking-tight" style={{ color: "#1a5fa8" }}>decoverdi</div>
          <div className="text-xs opacity-70 mt-0.5">Gestão de Obras</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(n => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                         : "hover:bg-sidebar-accent/60"
                }`}>
                <Icon className="w-4 h-4" />
                <span className="flex-1">{n.label}</span>
                {n.hasSubpages && active && <ChevronRight className="w-4 h-4 opacity-70" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <div className="text-xs opacity-70 truncate">{nome || "Utilizador"} · <span className="capitalize">{role}</span></div>
            <NotificationBell />
          </div>
          <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg" style={{ color: "#5b9bd5" }}>decoverdi</span>
            <span className="text-xs opacity-70">Gestão de Obras</span>
          </div>
          <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }} className="text-sm opacity-80">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          {children}
        </main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border flex justify-around z-40">
          {nav.map(n => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-xs ${
                  active ? "text-primary font-medium" : "text-muted-foreground"
                }`}>
                <Icon className="w-5 h-5" />
                <span>{n.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
