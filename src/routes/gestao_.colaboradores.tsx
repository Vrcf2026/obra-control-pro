import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { ArrowLeft, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/gestao_/colaboradores")({
  component: () => <Protected allow={["admin"]}><Page /></Protected>,
});

interface Colab {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
}

const EMPTY: Omit<Colab, "id"> = { nome: "", cargo: "", email: "", telefone: "", ativo: true };

function Page() {
  const [rows, setRows] = useState<Colab[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showNovo, setShowNovo] = useState(false);
  const [novoForm, setNovoForm] = useState(EMPTY);
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("colaboradores").select("*").order("nome") as any;
    setRows(data ?? []);
  }

  async function criar() {
    if (!novoForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("colaboradores").insert({
      nome: novoForm.nome.trim(),
      cargo: novoForm.cargo || null,
      email: novoForm.email || null,
      telefone: novoForm.telefone || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador criado");
    setShowNovo(false);
    setNovoForm(EMPTY);
    load();
  }

  async function guardar(id: string) {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("colaboradores").update({
      nome: form.nome.trim(),
      cargo: form.cargo || null,
      email: form.email || null,
      telefone: form.telefone || null,
      ativo: form.ativo,
    } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado");
    setEditId(null);
    load();
  }

  async function pedirApagar(id: string) {
    // Check if colaborador has obras associated
    const { data: obras } = await supabase.from("obras").select("id").eq("responsavel_interno_id" as any, id).limit(1);
    if (obras && obras.length > 0) {
      toast.error("Colaborador associado a obras — não pode ser eliminado");
      return;
    }
    setDelId(id);
  }

  async function apagar(id: string) {
    const { error } = await supabase.from("colaboradores").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      <div>
        <Link to="/gestao" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Colaboradores</h1>
          <button onClick={() => { setShowNovo(true); setNovoForm(EMPTY); }}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      {showNovo && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Novo colaborador</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <F label="Nome *"><input autoFocus value={novoForm.nome} onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))} className="inp" /></F>
            <F label="Cargo"><input value={novoForm.cargo ?? ""} onChange={e => setNovoForm(f => ({ ...f, cargo: e.target.value }))} className="inp" /></F>
            <F label="Email"><input type="email" value={novoForm.email ?? ""} onChange={e => setNovoForm(f => ({ ...f, email: e.target.value }))} className="inp" /></F>
            <F label="Telefone"><input value={novoForm.telefone ?? ""} onChange={e => setNovoForm(f => ({ ...f, telefone: e.target.value }))} className="inp" /></F>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNovo(false)} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
            <button onClick={criar} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Criar</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Cargo</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-left p-3 w-20">Activo</th>
              <th className="p-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                {editId === r.id ? (
                  <>
                    <td className="p-2"><input autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input value={form.cargo ?? ""} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input value={form.telefone ?? ""} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4" /></td>
                    <td className="p-2 text-right space-x-1">
                      <button onClick={() => guardar(r.id)} className="text-success p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-danger p-1"><X className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-medium">
                      <Link to="/gestao/colaboradores/$id" params={{ id: r.id }} className="hover:underline text-primary">
                        {r.nome}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.cargo || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.email || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.telefone || "—"}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {r.ativo ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => { setEditId(r.id); setForm({ nome: r.nome, cargo: r.cargo, email: r.email, telefone: r.telefone, ativo: r.ativo }); }}
                        className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => pedirApagar(r.id)} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem colaboradores.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <PasswordConfirmDialog
        open={!!delId}
        title="Remover colaborador"
        description="Confirme com a sua password."
        onClose={() => setDelId(null)}
        onConfirmed={() => delId && apagar(delId)}
      />
      <style>{`.inp{width:100%;border:1px solid var(--border);background:var(--background);border-radius:6px;padding:6px 10px;font-size:13px;outline:none}`}</style>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
