import { useMemo, useState } from "react";
import { eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle } from "lucide-react";
import { exportXlsx } from "@/lib/excel-export";

interface Obra { id: string; nome: string; estado: string }
interface Rubrica { id: string; obra_id: string; nome: string; orcamento_interno: number; parent_id: string | null }
interface Lanc { obra_id: string; rubrica_id: string | null; adenda_rubrica_id: string | null; rubrica_nome: string | null; valor: number; data: string }
interface AdRub { id: string; adenda_id: string; nome: string; valor: number }
interface Adenda { id: string; obra_id: string }

interface Props {
  obras: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[]; adRubs: AdRub[]; adendas: Adenda[];
}

export function RelatorioPorRubrica({ obras, rubricas, lancamentos, adRubs, adendas }: Props) {
  const [obraFiltro, setObraFiltro] = useState<string>("__todas__");

  // Normaliza nome de rubrica do lançamento — agrupando subrubricas pelo pai
  function rubKey(l: Lanc): string {
    if (l.rubrica_id) {
      const r = rubricas.find(x => x.id === l.rubrica_id);
      if (!r) return l.rubrica_nome ?? "Sem rubrica";
      if (r.parent_id) {
        const p = rubricas.find(x => x.id === r.parent_id);
        return p?.nome ?? r.nome;
      }
      return r.nome;
    }
    if (l.adenda_rubrica_id) {
      const ar = adRubs.find(a => a.id === l.adenda_rubrica_id);
      return ar?.nome ?? "Adenda";
    }
    return l.rubrica_nome ?? "Sem rubrica";
  }

  const obraIdsValidas = useMemo(() => obraFiltro === "__todas__" ? null : new Set([obraFiltro]), [obraFiltro]);

  const rows = useMemo(() => {
    // Orçamento por nome de rubrica (somando todos os pais com o mesmo nome)
    const orcMap = new Map<string, number>();
    rubricas.filter(r => !r.parent_id).forEach(r => {
      if (obraIdsValidas && !obraIdsValidas.has(r.obra_id)) return;
      orcMap.set(r.nome, (orcMap.get(r.nome) ?? 0) + Number(r.orcamento_interno));
    });

    // Gasto por nome de rubrica
    const gastoMap = new Map<string, number>();
    lancamentos.forEach(l => {
      if (obraIdsValidas && !obraIdsValidas.has(l.obra_id)) return;
      const k = rubKey(l);
      gastoMap.set(k, (gastoMap.get(k) ?? 0) + Number(l.valor));
    });

    const keys = new Set<string>([...orcMap.keys(), ...gastoMap.keys()]);
    return Array.from(keys).map(nome => {
      const orc = orcMap.get(nome) ?? 0;
      const gasto = gastoMap.get(nome) ?? 0;
      const desvio = orc - gasto; // positivo = sobra
      const exec = orc > 0 ? (gasto / orc) * 100 : (gasto > 0 ? 999 : 0);
      return { nome, orc, gasto, desvio, exec };
    }).sort((a, b) => b.gasto - a.gasto);
  }, [rubricas, lancamentos, obraIdsValidas, adRubs]);

  const tot = rows.reduce((a, r) => ({ orc: a.orc + r.orc, gasto: a.gasto + r.gasto }), { orc: 0, gasto: 0 });
  const totDesvio = tot.orc - tot.gasto;
  const totExec = tot.orc > 0 ? (tot.gasto / tot.orc) * 100 : 0;

  function exportar() {
    const data: (string | number)[][] = rows.map(r => [r.nome, r.orc, r.gasto, r.desvio, +r.exec.toFixed(2)]);
    data.push(["TOTAL", tot.orc, tot.gasto, totDesvio, +totExec.toFixed(2)]);
    exportXlsx(`relatorio_por_rubrica_${new Date().toISOString().slice(0,10)}`, [
      { name: "Rubricas", header: ["Rubrica", "Orçamento (€)", "Gasto (€)", "Desvio (€)", "Execução %"], rows: data, colWidths: [36, 16, 16, 16, 14] },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={obraFiltro} onValueChange={setObraFiltro}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas as obras</SelectItem>
            {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportar} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-medium">Execução orçamental por rubrica</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Rubrica</th>
                <th className="text-right p-3">Orçamento</th>
                <th className="text-right p-3">Gasto</th>
                <th className="text-right p-3">Desvio</th>
                <th className="text-right p-3 w-48">Execução</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cor = r.exec > 100 ? "bg-danger" : r.exec > 90 ? "bg-warning" : "bg-success";
                const barW = Math.min(r.exec, 130);
                return (
                  <tr key={r.nome} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-2">
                        {r.exec > 100 && <AlertTriangle className="w-4 h-4 text-danger" />}
                        {r.nome}
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{eur(r.orc)}</td>
                    <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                    <td className={`p-3 text-right tabular-nums ${r.desvio >= 0 ? "text-success" : "text-danger"}`}>{eur(r.desvio)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${cor} transition-all`} style={{ width: `${barW}%` }} />
                        </div>
                        <span className={`text-xs tabular-nums w-12 text-right ${r.exec > 100 ? "text-danger font-medium" : ""}`}>
                          {r.exec === 999 ? "—" : `${r.exec.toFixed(0)}%`}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/40 font-medium">
                <tr>
                  <td className="p-3">TOTAL</td>
                  <td className="p-3 text-right tabular-nums">{eur(tot.orc)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(tot.gasto)}</td>
                  <td className={`p-3 text-right tabular-nums ${totDesvio >= 0 ? "text-success" : "text-danger"}`}>{eur(totDesvio)}</td>
                  <td className="p-3 text-right tabular-nums">{totExec.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
