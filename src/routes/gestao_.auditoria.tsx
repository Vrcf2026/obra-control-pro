import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { ArrowLeft, Download, Trash2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/gestao_/auditoria")({
  component: () => <Protected allow={["admin"]}><Auditoria /></Protected>,
});

interface LogRow {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  acao: "INSERT" | "UPDATE" | "DELETE" | string;
  entidade: string;
  entidade_id: string | null;
  dados_antes: any;
  dados_depois: any;
}

const acaoLabel: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Eliminação",
};

const entidadeLabel: Record<string, string> = {
  obras: "Obra",
  lancamentos: "Lançamento",
  rubricas: "Rubrica",
  adendas: "Adenda",
  adenda_rubricas: "Rubrica de adenda",
  faturas_emitidas: "Factura",
  clientes: "Cliente",
  user_roles: "Papel de utilizador",
  obra_utilizadores: "Atribuição a obra",
  rubricas_padrao: "Rubrica padrão",
  profiles: "Perfil",
};

function Auditoria() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAcao, setFiltroAcao] = useState("");
  const [filtroEnt, setFiltroEnt] = useState("");
  const [filtroUser, setFiltroUser] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [detalhe, setDetalhe] = useState<LogRow | null>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) toast.error(error.message);
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filtroAcao && r.acao !== filtroAcao) return false;
      if (filtroEnt && r.entidade !== filtroEnt) return false;
      if (filtroUser && !(r.user_email ?? "").toLowerCase().includes(filtroUser.toLowerCase())) return false;
      if (dataDe && r.created_at < dataDe) return false;
      if (dataAte && r.created_at > dataAte + "T23:59:59") return false;
      return true;
    });
  }, [rows, filtroAcao, filtroEnt, filtroUser, dataDe, dataAte]);

  function exportar() {
    const data = filtered.map(r => ({
      "Data/Hora": new Date(r.created_at).toLocaleString("pt-PT"),
      "Utilizador": r.user_email ?? "—",
      "Acção": acaoLabel[r.acao] ?? r.acao,
      "Entidade": entidadeLabel[r.entidade] ?? r.entidade,
      "ID do registo": r.entidade_id ?? "",
      "Dados antes": r.dados_antes ? JSON.stringify(r.dados_antes) : "",
      "Dados depois": r.dados_depois ? JSON.stringify(r.dados_depois) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 38 }, { wch: 60 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `auditoria_${ts}.xlsx`);
  }

  async function eliminar(r: LogRow) {
    if (!confirm("Tem a certeza que pretende eliminar esta entrada do registo? Esta acção é irreversível.")) return;
    const { error } = await supabase.from("audit_log").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Entrada eliminada");
    setRows(rs => rs.filter(x => x.id !== r.id));
  }

  async function eliminarFiltradas() {
    if (filtered.length === 0) return;
    if (!confirm(`Tem a certeza que pretende eliminar ${filtered.length} entrada(s) do registo? Esta acção é irreversível.`)) return;
    const ids = filtered.map(r => r.id);
    const { error } = await supabase.from("audit_log").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success("Entradas eliminadas");
    load();
  }

  const entidades = Array.from(new Set(rows.map(r => r.entidade))).sort();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link to="/gestao" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Auditoria</h1>
        <p className="text-sm text-muted-foreground">Histórico de criações, alterações e eliminações</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)} className="border border-input bg-background rounded-md px-2 py-2 text-sm">
            <option value="">Todas as acções</option>
            <option value="INSERT">Criação</option>
            <option value="UPDATE">Alteração</option>
            <option value="DELETE">Eliminação</option>
          </select>
          <select value={filtroEnt} onChange={e => setFiltroEnt(e.target.value)} className="border border-input bg-background rounded-md px-2 py-2 text-sm">
            <option value="">Todas as entidades</option>
            {entidades.map(e => <option key={e} value={e}>{entidadeLabel[e] ?? e}</option>)}
          </select>
          <input value={filtroUser} onChange={e => setFiltroUser(e.target.value)} placeholder="Utilizador (email)" className="border border-input bg-background rounded-md px-2 py-2 text-sm" />
          <input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} className="border border-input bg-background rounded-md px-2 py-2 text-sm" />
          <input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} className="border border-input bg-background rounded-md px-2 py-2 text-sm" />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">{filtered.length} entrada(s)</div>
          <div className="flex gap-2">
            <button onClick={exportar} className="text-sm border border-input px-3 py-1.5 rounded-md inline-flex items-center gap-1">
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            <button onClick={eliminarFiltradas} disabled={filtered.length === 0} className="text-sm border border-danger/40 text-danger px-3 py-1.5 rounded-md inline-flex items-center gap-1 disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Eliminar filtradas
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Data/Hora</th>
              <th className="text-left p-3">Utilizador</th>
              <th className="text-left p-3">Acção</th>
              <th className="text-left p-3">Entidade</th>
              <th className="text-left p-3">ID do registo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">A carregar...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem entradas.</td></tr>}
            {!loading && filtered.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-PT")}</td>
                <td className="p-3">{r.user_email ?? "—"}</td>
                <td className="p-3">
                  <span className={
                    r.acao === "INSERT" ? "text-success" :
                    r.acao === "DELETE" ? "text-danger" :
                    "text-foreground"
                  }>{acaoLabel[r.acao] ?? r.acao}</span>
                </td>
                <td className="p-3">{entidadeLabel[r.entidade] ?? r.entidade}</td>
                <td className="p-3 font-mono text-xs text-muted-foreground">{r.entidade_id ?? "—"}</td>
                <td className="p-3 text-right whitespace-nowrap space-x-2">
                  <button onClick={() => setDetalhe(r)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
                    <Eye className="w-4 h-4" /> Detalhes
                  </button>
                  <button onClick={() => eliminar(r)} className="text-muted-foreground hover:text-danger inline-flex items-center gap-1 text-xs">
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detalhe && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-card border border-border rounded-lg max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-medium">{acaoLabel[detalhe.acao]} — {entidadeLabel[detalhe.entidade] ?? detalhe.entidade}</h3>
              <button onClick={() => setDetalhe(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div><span className="text-muted-foreground">Utilizador: </span>{detalhe.user_email ?? "—"}</div>
              <div><span className="text-muted-foreground">Quando: </span>{new Date(detalhe.created_at).toLocaleString("pt-PT")}</div>
              {detalhe.dados_antes && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Dados antes</div>
                  <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-auto">{JSON.stringify(detalhe.dados_antes, null, 2)}</pre>
                </div>
              )}
              {detalhe.dados_depois && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Dados depois</div>
                  <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-auto">{JSON.stringify(detalhe.dados_depois, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
