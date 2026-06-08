import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { ArrowLeft, Plus, Pencil, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/gestao_/fornecedores")({
  component: () => <Protected allow={["admin"]}><Page /></Protected>,
});

interface Forn { id: string; nome: string; nif: string | null; telefone: string | null; email: string | null; morada: string | null; ativo: boolean }
const EMPTY = { nome: "", nif: "", telefone: "", email: "", morada: "", ativo: true };

function Page() {
  const [rows, setRows] = useState<Forn[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [showNovo, setShowNovo] = useState(false);
  const [novoForm, setNovoForm] = useState(EMPTY);
  const [delId, setDelId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("fornecedores" as any).select("*").order("nome");
    setRows((data ?? []) as Forn[]);
  }

  async function criar() {
    if (!novoForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("fornecedores" as any).insert({
      nome: novoForm.nome.trim(), nif: novoForm.nif || null,
      telefone: novoForm.telefone || null, email: novoForm.email || null,
      morada: novoForm.morada || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Fornecedor criado"); setShowNovo(false); setNovoForm(EMPTY); load();
  }

  async function guardar(id: string) {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("fornecedores" as any).update({
      nome: form.nome.trim(), nif: form.nif || null, telefone: form.telefone || null,
      email: form.email || null, morada: form.morada || null, ativo: form.ativo,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado"); setEditId(null); load();
  }

  async function pedirApagar(id: string) {
    const { data } = await supabase.from("lancamentos").select("id").eq("fornecedor_id" as any, id).limit(1);
    if (data && data.length > 0) { toast.error("Fornecedor com lançamentos — não pode ser eliminado"); return; }
    setDelId(id);
  }

  async function apagar(id: string) {
    const { error } = await supabase.from("fornecedores" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removido"); load(); }
  }

  const filtered = rows.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()) ||
    (r.nif ?? "").includes(search));

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <div>
        <Link to="/gestao" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-semibold">Fornecedores</h1>
          <button onClick={() => { setShowNovo(true); setNovoForm(EMPTY); }}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por nome ou NIF..."
        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background max-w-sm" />

      {showNovo && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Novo fornecedor</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <F label="Nome *"><input autoFocus value={novoForm.nome} onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))} className="inp" /></F>
            <F label="NIF"><input value={novoForm.nif} onChange={e => setNovoForm(f => ({ ...f, nif: e.target.value }))} className="inp" /></F>
            <F label="Telefone"><input value={novoForm.telefone} onChange={e => setNovoForm(f => ({ ...f, telefone: e.target.value }))} className="inp" /></F>
            <F label="Email"><input type="email" value={novoForm.email} onChange={e => setNovoForm(f => ({ ...f, email: e.target.value }))} className="inp" /></F>
            <F label="Morada" ><input value={novoForm.morada} onChange={e => setNovoForm(f => ({ ...f, morada: e.target.value }))} className="inp" /></F>
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
              <th className="text-left p-3">NIF</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3 w-20">Activo</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-border">
                {editId === r.id ? (
                  <>
                    <td className="p-2"><input autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input value={form.nif ?? ""} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input value={form.telefone ?? ""} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="inp" /></td>
                    <td className="p-2"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4" /></td>
                    <td className="p-2 text-right space-x-1">
                      <button onClick={() => guardar(r.id)} className="text-success p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-danger p-1"><X className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3 font-medium">{r.nome}</td>
                    <td className="p-3 text-muted-foreground">{r.nif || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.telefone || "—"}</td>
                    <td className="p-3 text-muted-foreground">{r.email || "—"}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {r.ativo ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => { setEditId(r.id); setForm({ nome: r.nome, nif: r.nif ?? "", telefone: r.telefone ?? "", email: r.email ?? "", morada: r.morada ?? "", ativo: r.ativo }); }}
                        className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => pedirApagar(r.id)} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem fornecedores.</td></tr>}
          </tbody>
        </table>
      </div>

      <PasswordConfirmDialog open={!!delId} title="Remover fornecedor" description="Confirme com a sua password."
        onClose={() => setDelId(null)} onConfirmed={() => delId && apagar(delId)} />
      <style>{`.inp{width:100%;border:1px solid var(--border);background:var(--background);border-radius:6px;padding:6px 10px;font-size:13px;outline:none}`}</style>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
