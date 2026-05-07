import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { toast } from "sonner";
import type { Role } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { createUser, updateUser, deleteUser } from "@/lib/users.functions";

export const Route = createFileRoute("/gestao_/utilizadores")({
  component: () => <Protected allow={["admin"]}><Utilizadores /></Protected>,
});

interface Row { id: string; nome: string; email: string | null; role: Role | null }

const ROLES: Role[] = ["admin", "gestor", "encarregado"];

function Utilizadores() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

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

  async function handleDelete(r: Row) {
    if (!confirm(`Eliminar utilizador "${r.nome || r.email}"? Esta acção é irreversível.`)) return;
    try {
      await deleteUser({ data: { id: r.id } });
      toast.success("Utilizador eliminado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Utilizadores</h1>
          <p className="text-sm text-muted-foreground">Gerir utilizadores e os seus papéis</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-95"
        >
          <Plus className="w-4 h-4" /> Novo utilizador
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3 w-32">Papel</th>
              <th className="text-right p-3 w-32">Acções</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">A carregar...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem utilizadores.</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">{r.nome || "—"}</td>
                <td className="p-3 text-muted-foreground">{r.email ?? "—"}</td>
                <td className="p-3 capitalize">{r.role ?? "—"}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditing(r)}
                      className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={r.id === user?.id}
                      className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      title={r.id === user?.id ? "Não pode eliminar a própria conta" : "Eliminar"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && <UserForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <UserForm row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UserForm({ row, onClose, onSaved }: { row?: Row; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!row;
  const [nome, setNome] = useState(row?.nome ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(row?.role ?? "encarregado");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        await updateUser({ data: { id: row!.id, nome, role, password: password || undefined } });
        toast.success("Utilizador actualizado");
      } else {
        await createUser({ data: { email, password, nome, role } });
        toast.success("Utilizador criado");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? "Editar utilizador" : "Novo utilizador"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isEdit}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              {isEdit ? "Nova palavra-passe (opcional)" : "Palavra-passe"}
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required={!isEdit} minLength={isEdit ? undefined : 6}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Papel</label>
            <select value={role} onChange={e => setRole(e.target.value as Role)}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-2 text-sm capitalize">
              {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={busy}
              className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:opacity-95 disabled:opacity-50">
              {busy ? "..." : isEdit ? "Guardar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
