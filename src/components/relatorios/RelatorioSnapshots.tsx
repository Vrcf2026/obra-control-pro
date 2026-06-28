import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eur } from "@/lib/format";
import { snapshotMes } from "@/lib/jobs.functions";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Snap {
  id: string; obra_id: string; ano: number; mes: number;
  orcamento_total: number; custo_acumulado: number; faturado_acumulado: number;
  margem: number; margem_pct: number | null;
}
interface Obra { id: string; nome: string }

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function RelatorioSnapshots({ obras }: { obras: Obra[] }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [obraId, setObraId] = useState<string>("");
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("obra_snapshots_mensais").select("*").order("ano").order("mes");
    setSnaps((data ?? []).map((s: any) => ({
      ...s,
      orcamento_total: Number(s.orcamento_total),
      custo_acumulado: Number(s.custo_acumulado),
      faturado_acumulado: Number(s.faturado_acumulado),
      margem: Number(s.margem),
      margem_pct: s.margem_pct == null ? null : Number(s.margem_pct),
    })));
    setLoading(false);
  }

  async function gerar() {
    setRunning(true);
    try { await snapshotMes({ data: { ano, mes } }); await load(); }
    catch (e: any) { alert(e.message); }
    finally { setRunning(false); }
  }

  const nomeObra = (id: string) => obras.find(o => o.id === id)?.nome ?? "—";

  const obraOptions = useMemo(() => {
    const ids = new Set(snaps.map(s => s.obra_id));
    return obras.filter(o => ids.has(o.id));
  }, [snaps, obras]);

  const filtered = obraId ? snaps.filter(s => s.obra_id === obraId) : snaps;

  const chartData = useMemo(() => {
    if (!obraId) return [];
    return filtered
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map(s => ({
        label: `${MESES[s.mes - 1]}/${String(s.ano).slice(2)}`,
        Custo: s.custo_acumulado,
        Faturado: s.faturado_acumulado,
        Margem: s.margem,
      }));
  }, [filtered, obraId]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Ano</label>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))}
            className="border border-input rounded-md px-2 py-1.5 text-sm bg-background w-24" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Mês</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}
            className="border border-input rounded-md px-2 py-1.5 text-sm bg-background">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <button onClick={gerar} disabled={running}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {running ? "A gerar…" : "Gerar snapshot do período"}
        </button>
        <div className="flex-1" />
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Obra (gráfico)</label>
          <select value={obraId} onChange={e => setObraId(e.target.value)}
            className="border border-input rounded-md px-2 py-1.5 text-sm bg-background min-w-[200px]">
            <option value="">— Seleccionar —</option>
            {obraOptions.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      </div>

      {obraId && chartData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Evolução — {nomeObra(obraId)}</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => eur(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="Custo" stroke="#dc2626" strokeWidth={2} />
                <Line type="monotone" dataKey="Faturado" stroke="#1a5fa8" strokeWidth={2} />
                <Line type="monotone" dataKey="Margem" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Snapshots registados</h3>
          <p className="text-xs text-muted-foreground">{snaps.length} registos</p>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">A carregar…</div>
        ) : snaps.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum snapshot. Use o botão acima para gerar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Período</th>
                  <th className="text-left p-2">Obra</th>
                  <th className="text-right p-2">Orçamento</th>
                  <th className="text-right p-2">Custo acum.</th>
                  <th className="text-right p-2">Faturado acum.</th>
                  <th className="text-right p-2">Margem</th>
                  <th className="text-right p-2">%</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a,b) => b.ano - a.ano || b.mes - a.mes).map(s => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2 tabular-nums">{MESES[s.mes - 1]}/{s.ano}</td>
                    <td className="p-2">{nomeObra(s.obra_id)}</td>
                    <td className="p-2 text-right tabular-nums">{eur(s.orcamento_total)}</td>
                    <td className="p-2 text-right tabular-nums">{eur(s.custo_acumulado)}</td>
                    <td className="p-2 text-right tabular-nums">{eur(s.faturado_acumulado)}</td>
                    <td className={`p-2 text-right tabular-nums font-medium ${s.margem < 0 ? "text-destructive" : "text-green-700"}`}>{eur(s.margem)}</td>
                    <td className="p-2 text-right tabular-nums">{s.margem_pct == null ? "—" : `${s.margem_pct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
