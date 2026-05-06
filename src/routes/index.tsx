import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur, estadoLabel, estadoColor } from "@/lib/format";
import { AlertTriangle, Briefcase, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({ component: Page });

interface ObraRow {
  id: string; nome: string; cliente: string; estado: string;
  orc_cliente: number; orc_interno: number; gasto: number; ad_cli: number; ad_int: number;
}

function Page() {
  const { role } = useAuth();
  useEffect(() => { if (role === "encarregado") window.location.replace("/minhas-obras"); }, [role]);
  return <Protected allow={["admin", "gestor", "encarregado"]}><Dashboard /></Protected>;
}

function Dashboard() {
  const [rows, setRows] = useState<ObraRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: obras }, { data: rubricas }, { data: lanc }, { data: adendas }, { data: adRubs }] = await Promise.all([
      supabase.from("obras").select("id,nome,cliente,estado,orcamento_cliente").order("created_at", { ascending: false }),
      supabase.from("rubricas").select("obra_id,orcamento_interno"),
      supabase.from("lancamentos").select("obra_id,valor"),
      supabase.from("adendas").select("id,obra_id,valor_cliente"),
      supabase.from("adenda_rubricas").select("adenda_id,valor"),
    ]);

    const map = new Map<string, ObraRow>();
    (obras ?? []).forEach(o => map.set(o.id, {
      id: o.id, nome: o.nome, cliente: o.cliente, estado: o.estado,
      orc_cliente: Number(o.orcamento_cliente), orc_interno: 0, gasto: 0, ad_cli: 0, ad_int: 0,
    }));
    (rubricas ?? []).forEach(r => { const o = map.get(r.obra_id); if (o) o.orc_interno += Number(r.orcamento_interno); });
    const adObra = new Map<string, string>();
    (adendas ?? []).forEach(a => { adObra.set(a.id, a.obra_id); const o = map.get(a.obra_id); if (o) o.ad_cli += Number(a.valor_cliente); });
    (adRubs ?? []).forEach(r => { const ob = adObra.get(r.adenda_id); if (!ob) return; const o = map.get(ob); if (o) o.ad_int += Number(r.valor); });
    (lanc ?? []).forEach(l => { const o = map.get(l.obra_id); if (o) o.gasto += Number(l.valor); });

    setRows(Array.from(map.values()));
    setLoading(false);
  }

  const summary = useMemo(() => {
    const ativas = rows.filter(r => ["adjudicada", "em_curso"].includes(r.estado)).length;
    const margem = rows.reduce((s, r) => s + ((r.orc_cliente + r.ad_cli) - (r.orc_interno + r.ad_int)), 0);
    let atencao = 0, risco = 0;
    rows.forEach(r => {
      const fat = r.orc_cliente + r.ad_cli;
      const m = fat - (r.orc_interno + r.ad_int);
      const pct = fat > 0 ? (m / fat) * 100 : 0;
      if (pct < 0) risco++;
      else if (pct < 10) atencao++;
    });
    return { ativas, margem, atencao, risco };
  }, [rows]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão global das obras</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={<Briefcase className="w-5 h-5" />} label="Obras activas" value={String(summary.ativas)} />
        <Card icon={<TrendingUp className="w-5 h-5" />} label="Margem prevista total" value={eur(summary.margem)} accent={summary.margem >= 0 ? "success" : "danger"} />
        <Card icon={<AlertTriangle className="w-5 h-5" />} label="Em atenção" value={String(summary.atencao)} accent={summary.atencao > 0 ? "warning" : undefined} />
        <Card icon={<AlertTriangle className="w-5 h-5" />} label="Em risco" value={String(summary.risco)} accent={summary.risco > 0 ? "danger" : undefined} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h2 className="font-medium">Obras</h2></div>
        {loading ? <div className="p-8 text-center text-muted-foreground">A carregar...</div>
        : rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">Sem obras. Crie em <Link to="/gestao" className="text-primary underline">Gestão</Link>.</div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Obra</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Orç. cliente</th>
                  <th className="text-right p-3">Total faturável</th>
                  <th className="text-right p-3">Gasto real</th>
                  <th className="text-right p-3">Margem €</th>
                  <th className="text-right p-3">Margem %</th>
                  <th className="text-center p-3">Sem.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const fat = r.orc_cliente + r.ad_cli;
                  const margem = fat - r.gasto;
                  const pct = fat > 0 ? (margem / fat) * 100 : 0;
                  const sem = pct > 10 ? "bg-success" : pct >= 0 ? "bg-warning" : "bg-danger";
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3"><Link to="/obras/$id" params={{ id: r.id }} className="font-medium hover:text-primary">{r.nome}</Link></td>
                      <td className="p-3 text-muted-foreground">{r.cliente}</td>
                      <td className="p-3"><span className={`text-xs px-2 py-1 rounded-md font-medium ${estadoColor[r.estado]}`}>{estadoLabel[r.estado]}</span></td>
                      <td className="p-3 text-right tabular-nums">{eur(r.orc_cliente)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(fat)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                      <td className={`p-3 text-right tabular-nums ${margem >= 0 ? "text-success" : "text-danger"}`}>{eur(margem)}</td>
                      <td className={`p-3 text-right tabular-nums ${pct >= 0 ? "" : "text-danger"}`}>{pct.toFixed(1)}%</td>
                      <td className="p-3 text-center"><span className={`inline-block w-3 h-3 rounded-full ${sem}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "success" | "danger" | "warning" }) {
  const accentCls = accent === "success" ? "text-success" : accent === "danger" ? "text-danger" : accent === "warning" ? "text-warning" : "";
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>{icon}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${accentCls}`}>{value}</div>
    </div>
  );
}
