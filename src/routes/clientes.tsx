import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Eye, Edit, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/clientes")({
  component: () => <Protected allow={["admin"]}><Page /></Protected>,
});

interface Cliente { id: string; nome: string; nif: string | null; telefone: string | null }

function Page() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [list, setList] = useState<Cliente[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [delCliente, setDelCliente] = useState<Cliente | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("clientes").select("id,nome,nif,telefone").order("nome");
    setList((data ?? []) as Cliente[]);
    const { data: ob } = await supabase.from("obras").select("cliente_id");
    const c: Record<string, number> = {};
    (ob ?? []).forEach((o: any) => { if (o.cliente_id) c[o.cliente_id] = (c[o.cliente_id] || 0) + 1; });
    setCounts(c);
  }

  function pedirApagar(c: Cliente) {
    if ((counts[c.id] || 0) > 0) { toast.error("Cliente associado a obras — não pode ser eliminado"); return; }
    setDelCliente(c);
  }
  async function apagarConfirmado() {
    if (!delCliente) return;
    const { error } = await supabase.from("clientes").delete().eq("id", delCliente.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente eliminado");
    load();
  }

  const filtered = list.filter(c => {
    const m = q.trim().toLowerCase();
    return !m || c.nome.toLowerCase().includes(m) || (c.nif || "").toLowerCase().includes(m);
  });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Lista de clientes</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Novo cliente
          </button>
        )}
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Pesquisar por nome ou NIF..."
        className="w-full sm:max-w-sm border border-input rounded-md px-3 py-2 text-sm bg-background" />

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">NIF</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-right p-3">Nº Obras</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem clientes.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3"><Link to="/clientes/$id" params={{ id: c.id }} className="font-medium text-primary hover:underline">{c.nome}</Link></td>
                <td className="p-3 text-muted-foreground">{c.nif || "—"}</td>
                <td className="p-3 text-muted-foreground">{c.telefone || "—"}</td>
                <td className="p-3 text-right tabular-nums">{counts[c.id] || 0}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <Link to="/clientes/$id" params={{ id: c.id }} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Eye className="w-4 h-4" /> Ver
                  </Link>
                  {isAdmin && (
                    <button onClick={() => { setEditing(c); setShowForm(true); }} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <Edit className="w-4 h-4" /> Editar
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => pedirApagar(c)}
                      disabled={(counts[c.id] || 0) > 0}
                      title={(counts[c.id] || 0) > 0 ? "Cliente associado a obras — não pode ser eliminado" : "Eliminar"}
                      className={`text-sm inline-flex items-center gap-1 ${(counts[c.id] || 0) > 0 ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-danger"}`}
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && <ClienteForm cliente={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      <PasswordConfirmDialog
        open={!!delCliente}
        title={`Eliminar cliente — ${delCliente?.nome ?? ""}`}
        description="Esta acção é irreversível. Confirme com a sua password."
        onClose={() => setDelCliente(null)}
        onConfirmed={apagarConfirmado}
      />
    </div>
  );
}

function ClienteForm({ cliente, onClose, onSaved }: { cliente: Cliente | null; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [nif, setNif] = useState(cliente?.nif ?? "");
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "");

  async function save() {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = { nome: nome.trim(), nif: nif || null, telefone: telefone || null };
    const { error } = cliente
      ? await supabase.from("clientes").update(payload).eq("id", cliente.id)
      : await supabase.from("clientes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente guardado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-end" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card w-full sm:max-w-md sm:h-full p-5 space-y-3 rounded-t-lg sm:rounded-none">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{cliente ? "Editar cliente" : "Novo cliente"}</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <label className="block text-sm"><span className="text-muted-foreground">Nome *</span>
          <input value={nome} onChange={e => setNome(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background" />
        </label>
        <label className="block text-sm"><span className="text-muted-foreground">NIF</span>
          <input value={nif} onChange={e => setNif(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background" />
        </label>
        <label className="block text-sm"><span className="text-muted-foreground">Telefone</span>
          <input value={telefone} onChange={e => setTelefone(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={save} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar</button>
        </div>
      </div>
    </div>
  );
}
