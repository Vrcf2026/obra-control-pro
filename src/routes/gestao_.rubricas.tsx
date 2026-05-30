import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao_/rubricas")({
  component: () => <Protected allow={["admin"]}><Page /></Protected>,
});

interface Rub { id: string; nome: string; ativo: boolean; ordem: number }

function Page() {
  const [rows, setRows] = useState<Rub[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [usados, setUsados] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data }, { data: r }, { data: ar }] = await Promise.all([
      supabase.from("rubricas_padrao").select("*").order("ordem"),
      supabase.from("rubricas").select("nome"),
      supabase.from("adenda_rubricas").select("nome"),
    ]);
    setRows((data ?? []) as Rub[]);
    const u = new Set<string>();
    (r ?? []).forEach(x => u.add(x.nome));
    (ar ?? []).forEach(x => u.add(x.nome));
    setUsados(u);
  }

  async function novo() {
    const ordem = rows.length > 0 ? Math.min(...rows.map(r => r.ordem)) - 1 : 0;
    const { data, error } = await supabase.from("rubricas_padrao").insert({ nome: "Nova rubrica", ordem }).select("*").single();
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    setRows(rs => [data as Rub, ...rs]);
    setEditId((data as Rub).id);
    setEditNome((data as Rub).nome);
  }

  async function saveNome(id: string) {
    if (!editNome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("rubricas_padrao").update({ nome: editNome.trim() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditId(null);
    load();
  }

  async function toggleAtivo(r: Rub) {
    const { error } = await supabase.from("rubricas_padrao").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) toast.error(error.message); else load();
  }

  function pedirApagar(r: Rub) {
    if (usados.has(r.nome)) { toast.error("Rubrica em uso, não pode ser apagada"); return; }
    setDelRub(r);
  }
  async function apagarConfirmado() {
    if (!delRub) return;
    const { error } = await supabase.from("rubricas_padrao").delete().eq("id", delRub.id);
    if (error) toast.error(error.message); else load();
  }

  async function mover(r: Rub, dir: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.ordem - b.ordem);
    const i = sorted.findIndex(x => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await Promise.all([
      supabase.from("rubricas_padrao").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("rubricas_padrao").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    load();
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      <div>
        <Link to="/gestao" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Rubricas padrão</h1>
          <button onClick={novo} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Nova rubrica
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 w-24">Ordem</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 w-24">Activa</th>
              <th className="p-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2">
                  <div className="flex gap-1">
                    <button onClick={() => mover(r, -1)} className="text-muted-foreground hover:text-foreground p-1"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => mover(r, 1)} className="text-muted-foreground hover:text-foreground p-1"><ChevronDown className="w-4 h-4" /></button>
                  </div>
                </td>
                <td className="p-2">
                  {editId === r.id ? (
                    <div className="flex gap-1">
                      <input autoFocus value={editNome} onChange={e => setEditNome(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveNome(r.id); if (e.key === "Escape") setEditId(null); }}
                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                      <button onClick={() => saveNome(r.id)} className="text-success p-1"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-danger p-1"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditId(r.id); setEditNome(r.nome); }} className="text-left w-full hover:text-primary">{r.nome}</button>
                  )}
                </td>
                <td className="p-2">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={r.ativo} onChange={() => toggleAtivo(r)} className="w-4 h-4" />
                  </label>
                </td>
                <td className="p-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => { setEditId(r.id); setEditNome(r.nome); }} className="text-muted-foreground hover:text-foreground p-1" title="Editar"><Pencil className="w-4 h-4" /></button>
                  <button
                    onClick={() => apagar(r)}
                    disabled={usados.has(r.nome)}
                    className={`p-1 ${usados.has(r.nome) ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-danger"}`}
                    title={usados.has(r.nome) ? "Rubrica em uso" : "Apagar"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem rubricas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
