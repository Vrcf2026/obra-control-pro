import { useMemo, useState } from "react";
import { eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChevronRight, Download } from "lucide-react";
import { exportXlsx } from "@/lib/excel-export";

interface Obra { id: string; nome: string; cliente: string; cliente_id: string | null; estado: string; orcamento_cliente: number }
interface Rubrica { obra_id: string; orcamento_interno: number }
interface Lanc { obra_id: string; valor: number; data: string }
interface Adenda { id: string; obra_id: string; valor_cliente: number; valor_interno: number }
interface Cliente { id: string; nome: string }

interface Props {
  obras: Obra[]; rubricas: Rubrica[]; lancamentos: Lanc[]; adendas: Adenda[]; clientes: Cliente[];
}

export function RelatorioPorCliente({ obras, rubricas, lancamentos, adendas, clientes }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const cliMap = new Map(clientes.map(c => [c.id, c.nome]));
    const map = new Map<string, {
      key: string; nome: string;
      obras: Array<{ id: string; nome: string; estado: string; fat: number; gasto: number; margem: number; pct: number }>;
      nObras: number; fat: number; gasto: number;
    }>();

    obras.forEach(o => {
      const key = o.cliente_id ?? `__t__${o.cliente}`;
      const nome = o.cliente_id ? (cliMap.get(o.cliente_id) ?? o.cliente) : o.cliente;
      const orcInt = rubricas.filter(r => r.obra_id === o.id).reduce((s, r) => s + Number(r.orcamento_interno), 0);
      const adObra = adendas.filter(a => a.obra_id === o.id);
      const adCli = adObra.reduce((s, a) => s + Number(a.valor_cliente), 0);
      const adInt = adObra.reduce((s, a) => s + Number(a.valor_interno), 0);
      const fat = Number(o.orcamento_cliente) + adCli;
      const gasto = lancamentos.filter(l => l.obra_id === o.id).reduce((s, l) => s + Number(l.valor), 0);
      const margem = fat - gasto;
      const pct = fat > 0 ? (margem / fat) * 100 : 0;
      const cur = map.get(key) ?? { key, nome, obras: [], nObras: 0, fat: 0, gasto: 0 };
      cur.obras.push({ id: o.id, nome: o.nome, estado: o.estado, fat, gasto, margem, pct });
      cur.nObras += 1; cur.fat += fat; cur.gasto += gasto;
      map.set(key, cur);
    });

    return Array.from(map.values())
      .map(r => ({ ...r, margem: r.fat - r.gasto, pct: r.fat > 0 ? ((r.fat - r.gasto) / r.fat) * 100 : 0 }))
      .sort((a, b) => b.fat - a.fat);
  }, [obras, rubricas, lancamentos, adendas, clientes]);

  const tot = useMemo(() => rows.reduce((acc, r) => ({
    nObras: acc.nObras + r.nObras, fat: acc.fat + r.fat, gasto: acc.gasto + r.gasto, margem: acc.margem + r.margem,
  }), { nObras: 0, fat: 0, gasto: 0, margem: 0 }), [rows]);

  function toggle(k: string) {
    setOpen(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  function exportar() {
    const resumo: (string | number)[][] = rows.map(r => [r.nome, r.nObras, r.fat, r.gasto, r.margem, +r.pct.toFixed(2)]);
    resumo.push(["TOTAL", tot.nObras, tot.fat, tot.gasto, tot.margem, tot.fat > 0 ? +((tot.margem / tot.fat) * 100).toFixed(2) : 0]);
    const detalhe: (string | number)[][] = [];
    rows.forEach(r => r.obras.forEach(o => detalhe.push([r.nome, o.nome, o.estado, o.fat, o.gasto, o.margem, +o.pct.toFixed(2)])));
    exportXlsx(`relatorio_por_cliente_${new Date().toISOString().slice(0,10)}`, [
      { name: "Resumo", header: ["Cliente", "Nº Obras", "Faturável (€)", "Gasto (€)", "Margem (€)", "Margem %"], rows: resumo, colWidths: [32, 10, 16, 16, 16, 12] },
      { name: "Detalhe", header: ["Cliente", "Obra", "Estado", "Faturável (€)", "Gasto (€)", "Margem (€)", "Margem %"], rows: detalhe, colWidths: [28, 32, 14, 16, 16, 16, 12] },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportar} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-medium">Resumo por cliente</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3 w-8"></th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-right p-3">Nº Obras</th>
                <th className="text-right p-3">Faturável</th>
                <th className="text-right p-3">Gasto</th>
                <th className="text-right p-3">Margem €</th>
                <th className="text-right p-3">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isOpen = open.has(r.key);
                return (
                  <>
                    <tr key={r.key} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => toggle(r.key)}>
                      <td className="p-3"><ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} /></td>
                      <td className="p-3 font-medium">{r.nome}</td>
                      <td className="p-3 text-right tabular-nums">{r.nObras}</td>
                      <td className="p-3 text-right tabular-nums">{eur(r.fat)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                      <td className={`p-3 text-right tabular-nums ${r.margem >= 0 ? "text-success" : "text-danger"}`}>{eur(r.margem)}</td>
                      <td className={`p-3 text-right tabular-nums ${r.pct >= 0 ? "" : "text-danger"}`}>{r.pct.toFixed(1)}%</td>
                    </tr>
                    {isOpen && r.obras.map(o => (
                      <tr key={`${r.key}-${o.id}`} className="border-t border-border bg-muted/20 text-sm">
                        <td></td>
                        <td className="p-2 pl-8 text-muted-foreground">↳ {o.nome} <span className="text-xs">({o.estado})</span></td>
                        <td></td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground">{eur(o.fat)}</td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground">{eur(o.gasto)}</td>
                        <td className={`p-2 text-right tabular-nums ${o.margem >= 0 ? "text-success" : "text-danger"}`}>{eur(o.margem)}</td>
                        <td className={`p-2 text-right tabular-nums ${o.pct >= 0 ? "text-muted-foreground" : "text-danger"}`}>{o.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-muted/40 font-medium">
                <tr>
                  <td></td>
                  <td className="p-3">TOTAL</td>
                  <td className="p-3 text-right tabular-nums">{tot.nObras}</td>
                  <td className="p-3 text-right tabular-nums">{eur(tot.fat)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(tot.gasto)}</td>
                  <td className={`p-3 text-right tabular-nums ${tot.margem >= 0 ? "text-success" : "text-danger"}`}>{eur(tot.margem)}</td>
                  <td className="p-3 text-right tabular-nums">{tot.fat > 0 ? ((tot.margem / tot.fat) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
