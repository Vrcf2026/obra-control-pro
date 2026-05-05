import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { toast } from "sonner";
import type { Role } from "@/hooks/use-auth";

export const Route = createFileRoute("/gestao/utilizadores")({
  component: () => <Protected allow={["admin"]}><Utilizadores /></Protected>,
});

interface Row { id: string; nome: string; email: string | null; role: Role | null }

const ROLES: Role[] = ["admin", "gestor", "encarregado"];

function Utilizadores() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,nome,email").order("nome"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const order: Role[] = ["admin", "gestor", "encarregado"];
    const merged: Row[] = (profiles ?? []).map(p => {
      const userRoles = (roles ?? []).filter(r => r.user_id === p.id).map(r => r.role as Role);
      const top = order.find(r => userRoles.includes(r)) ?? null;
      return { id: p.id, nome: p.nome, email: p.email, role: top };
    });
    setRows(merged);
    setLoading(false);
  }

  async function changeRole(userId: string, newRole: Role) {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Papel actualizado");
    setRows(rs => rs.map(r => r.id === userId ? { ...r, role: newRole } : r));
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Utilizadores</h1>
        <p className="text-sm text-muted-foreground">Gerir papéis dos utilizadores registados</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3 w-48">Papel</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">A carregar...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Sem utilizadores.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">{r.nome || "—"}</td>
                <td className="p-3 text-muted-foreground">{r.email ?? "—"}</td>
                <td className="p-3">
                  <select
                    value={r.role ?? ""}
                    onChange={e => changeRole(r.id, e.target.value as Role)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    {!r.role && <option value="">— sem papel —</option>}
                    {ROLES.map(role => (
                      <option key={role} value={role} className="capitalize">{role}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
