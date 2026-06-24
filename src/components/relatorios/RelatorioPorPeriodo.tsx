import { useMemo, useState } from "react";
import { eur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { exportXlsx } from "@/lib/excel-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Line, ComposedChart } from "recharts";

interface Lanc { obra_id: string; valor: number; data: string }
interface Fatura { obra_id: string; valor: number; data: string }
interface Obra { id: string; nome: string }

interface Props {
  lancamentos: Lanc[]; faturas: Fatura[]; obras: Obra[];
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function RelatorioPorPeriodo({ lancamentos, faturas, obras }: Props) {
  const anos = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    lancamentos.forEach(l => set.add(new Date(l.data).getFullYear()));
    faturas.forEach(f => set.add(new Date(f.data).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [lancamentos, faturas]);

  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [obraId, setObraId] = useState<string>("__todas__");
  const [homologo, setHomologo] = useState<boolean>(false);

  function calcAno(targetAno: number) {
    const meses = MESES.map((m, i) => ({ mes: m, idx: i, gasto: 0, faturacao: 0, margem: 0 }));
    lancamentos.forEach(l => {
      const d = new Date(l.data);
      if (d.getFullYear() !== targetAno) return;
      if (obraId !== "__todas__" && l.obra_id !== obraId) return;
      meses[d.getMonth()].gasto += Number(l.valor);
    });
    faturas.forEach(f => {
      const d = new Date(f.data);
      if (d.getFullYear() !== targetAno) return;
      if (obraId !== "__todas__" && f.obra_id !== obraId) return;
      meses[d.getMonth()].faturacao += Number(f.valor);
    });
    let acGasto = 0, acFat = 0;
    return meses.map(m => {
      m.margem = m.faturacao - m.gasto;
      acGasto += m.gasto; acFat += m.faturacao;
      return { ...m, acGasto, acFat };
    });
  }

  const dados = useMemo(() => {
    const cur = calcAno(ano);
    if (!homologo) return cur;
    const prev = calcAno(ano - 1);
    return cur.map((m, i) => ({
      ...m,
      faturacaoH: prev[i].faturacao,
      gastoH: prev[i].gasto,
      margemH: prev[i].margem,
      deltaFatPct: prev[i].faturacao > 0 ? ((m.faturacao - prev[i].faturacao) / prev[i].faturacao) * 100 : null,
      deltaGastoPct: prev[i].gasto > 0 ? ((m.gasto - prev[i].gasto) / prev[i].gasto) * 100 : null,
    }));
  }, [lancamentos, faturas, ano, obraId, homologo]);

  const tot = dados.reduce((a, m) => ({ gasto: a.gasto + m.gasto, fat: a.fat + m.faturacao }), { gasto: 0, fat: 0 });
  const totMargem = tot.fat - tot.gasto;
  const totHomologo = homologo
    ? dados.reduce((a, m: any) => ({ gasto: a.gasto + (m.gastoH ?? 0), fat: a.fat + (m.faturacaoH ?? 0) }), { gasto: 0, fat: 0 })
    : null;

  function exportar() {
    const headers = homologo
      ? ["Mês", `Fat ${ano}`, `Fat ${ano-1}`, "Δ Fat %", `Gasto ${ano}`, `Gasto ${ano-1}`, "Δ Gasto %", `Margem ${ano}`, `Margem ${ano-1}`]
      : ["Mês", "Faturação (€)", "Gasto (€)", "Margem (€)", "Faturação acum.", "Gasto acum."];
    const data: (string | number | null)[][] = homologo
      ? dados.map((m: any) => [m.mes, m.faturacao, m.faturacaoH, m.deltaFatPct == null ? "" : Number(m.deltaFatPct.toFixed(1)), m.gasto, m.gastoH, m.deltaGastoPct == null ? "" : Number(m.deltaGastoPct.toFixed(1)), m.margem, m.margemH])
      : dados.map(m => [m.mes, m.faturacao, m.gasto, m.margem, (m as any).acFat, (m as any).acGasto]);
    if (!homologo) data.push(["TOTAL", tot.fat, tot.gasto, totMargem, tot.fat, tot.gasto]);
    exportXlsx(`relatorio_periodo_${ano}${homologo ? "_vs_" + (ano-1) : ""}_${obraId === "__todas__" ? "global" : obraId.slice(0,8)}`, [
      { name: `${ano}${homologo ? " vs " + (ano-1) : ""}`, header: headers, rows: data, colWidths: headers.map(() => 16) },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={obraId} onValueChange={setObraId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas__">Todas as obras</SelectItem>
            {obras.map(o => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportar}>
          <Download className="w-4 h-4 mr-2" /> Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground">Faturação {ano}</div>
          <div className="text-xl font-semibold tabular-nums">{eur(tot.fat)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground">Gasto {ano}</div>
          <div className="text-xl font-semibold tabular-nums">{eur(tot.gasto)}</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground">Margem {ano}</div>
          <div className={`text-xl font-semibold tabular-nums ${totMargem >= 0 ? "text-success" : "text-danger"}`}>{eur(totMargem)}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="font-medium mb-3">Evolução mensal</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mes" />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => eur(Number(v))} />
            <Legend />
            <Bar dataKey="faturacao" name="Faturação" fill="#16a34a" />
            <Bar dataKey="gasto" name="Gasto" fill="#dc2626" />
            <Line type="monotone" dataKey="margem" name="Margem" stroke="#1a5fa8" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border font-medium">Detalhe mensal</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Mês</th>
                <th className="text-right p-3">Faturação</th>
                <th className="text-right p-3">Gasto</th>
                <th className="text-right p-3">Margem</th>
                <th className="text-right p-3">Fat. acum.</th>
                <th className="text-right p-3">Gasto acum.</th>
              </tr>
            </thead>
            <tbody>
              {dados.map(m => (
                <tr key={m.mes} className="border-t border-border">
                  <td className="p-3 font-medium">{m.mes}</td>
                  <td className="p-3 text-right tabular-nums">{eur(m.faturacao)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(m.gasto)}</td>
                  <td className={`p-3 text-right tabular-nums ${m.margem >= 0 ? "text-success" : "text-danger"}`}>{eur(m.margem)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">{eur(m.acFat)}</td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">{eur(m.acGasto)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-medium">
              <tr>
                <td className="p-3">TOTAL</td>
                <td className="p-3 text-right tabular-nums">{eur(tot.fat)}</td>
                <td className="p-3 text-right tabular-nums">{eur(tot.gasto)}</td>
                <td className={`p-3 text-right tabular-nums ${totMargem >= 0 ? "text-success" : "text-danger"}`}>{eur(totMargem)}</td>
                <td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
