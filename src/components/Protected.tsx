import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, type Role } from "@/hooks/use-auth";
import { AppLayout } from "./AppLayout";

export function Protected({ children, allow }: { children: ReactNode; allow?: Role[] }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (allow && role && !allow.includes(role)) navigate({ to: "/" });
  }, [loading, user, role, allow, navigate]);

  if (loading || !user || !role) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">A carregar...</div>;
  }
  if (allow && !allow.includes(role)) return null;
  return <AppLayout>{children}</AppLayout>;
}
