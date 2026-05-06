import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, HardHat, Settings, LogOut, Building2, Users, BarChart2, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">ObraControl</div>
            <div className="text-xs opacity-70">Custos de obra</div>
          </div>
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
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs opacity-70">{nome || "Utilizador"} · <span className="capitalize">{role}</span></div>
          <button onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent/60">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold">ObraControl</span>
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
