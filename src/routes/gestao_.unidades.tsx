import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { ArrowLeft, Plus, Pencil, Check, X, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/gestao_/unidades")({
  component: () => <Protected allow={["admin"]}><Page /></Protected>,
});

interface Unidade { id: string; nome: string; sigla: string; ordem: number }

function Page() {
  const [rows, setRows] = useState<Unidade[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editSigla, setEditSigla] = useState("");
  const [showNovo, setShowNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoSigla, setNovoSigla] = useState("");
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("unidades").select("*").order("ordem");
    setRows((data ?? []) as unknown as Unidade[]);
  }

  async function criar() {
    if (!novoNome.trim() || !novoSigla.trim()) { toast.error("Nome e sigla obrigatórios"); return; }
    const maxOrdem = rows.reduce((m, r) => Math.max(m, r.ordem), 0);
    const { error } = await supabase.from("unidades").insert({ nome: novoNome.trim(), sigla: novoSigla.trim(), ordem: maxOrdem + 1 });
    if (error) { toast.error(error.message); return; }
    toast.success("Unidade criada"); setShowNovo(false); setNovoNome(""); setNovoSigla(""); load();
  }

  async function guardar(id: string) {
    if (!editNome.trim() || !editSigla.trim()) { toast.error("Nome e sigla obrigatórios"); return; }
    const { error } = await supabase.from("unidades").update({ nome: editNome.trim(), sigla: editSigla.trim() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditId(null); load();
  }

  async function pedirApagar(id: string) {
    const { data } = await supabase.from("lancamentos").select("id").eq("unidade_id", id).limit(1);
    if (data && data.length > 0) { toast.error("Unidade em uso — não pode ser eliminada"); return; }
    setDelId(id);
  }

  async function apagar(id: string) {
    const { error } = await supabase.from("unidades").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removida"); load(); }
  }

  async function mover(r: Unidade, dir: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.ordem - b.ordem);
    const i = sorted.findIndex(x => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await Promise.all([
      supabase.from("unidades").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("unidades").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    load();
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-2xl">
      <div>
        <Link to="/gestao" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Unidades</h1>
          <button onClick={() => setShowNovo(true)} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>
      </div>

      {showNovo && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Nova unidade</p>
          <div className="grid grid-cols-2 gap-3">
            <F label="Nome *"><input autoFocus value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Metro linear" className="inp" /></F>
            <F label="Sigla *"><input value={novoSigla} onChange={e => setNovoSigla(e.target.value)} placeholder="Ex: ml" className="inp" /></F>
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
              <th className="text-left p-3 w-24">Ordem</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 w-24">Sigla</th>
              <th className="p-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => a.ordem - b.ordem).map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2">
                  <div className="flex gap-1">
                    <button onClick={() => mover(r, -1)} className="text-muted-foreground hover:text-foreground p-1"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => mover(r, 1)} className="text-muted-foreground hover:text-foreground p-1"><ChevronDown className="w-4 h-4" /></button>
                  </div>
                </td>
                {editId === r.id ? (
                  <>
                    <td className="p-2"><input autoFocus value={editNome} onChange={e => setEditNome(e.target.value)} className="inp"
                      onKeyDown={e => { if (e.key === "Enter") guardar(r.id); if (e.key === "Escape") setEditId(null); }} /></td>
                    <td className="p-2"><input value={editSigla} onChange={e => setEditSigla(e.target.value)} className="inp" /></td>
                    <td className="p-2 text-right space-x-1">
                      <button onClick={() => guardar(r.id)} className="text-success p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground p-1"><X className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3">{r.nome}</td>
                    <td className="p-3 text-muted-foreground font-mono">{r.sigla}</td>
                    <td className="p-3 text-right space-x-1">
                      <button onClick={() => { setEditId(r.id); setEditNome(r.nome); setEditSigla(r.sigla); }} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => pedirApagar(r.id)} className="text-muted-foreground hover:text-danger p-1"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem unidades.</td></tr>}
          </tbody>
        </table>
      </div>

      <PasswordConfirmDialog open={!!delId} title="Remover unidade" description="Confirme com a sua password."
        onClose={() => setDelId(null)} onConfirmed={() => { if (delId) apagar(delId); }} />
      <style>{`.inp{width:100%;border:1px solid var(--border);background:var(--background);border-radius:6px;padding:6px 10px;font-size:13px;outline:none}`}</style>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
