import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "admin" | "gestor" | "encarregado";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role | null;
  nome: string;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null, session: null, role: null, nome: "", loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRole(null); setNome("");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("nome").eq("id", uid).maybeSingle(),
    ]);
    const order: Role[] = ["admin", "gestor", "encarregado"];
    const found = order.find(r => roles?.some(x => x.role === r)) ?? null;
    setRole(found);
    setNome(prof?.nome ?? "");
    setLoading(false);
  }

  async function signOut() { await supabase.auth.signOut(); }

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, role, nome, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
