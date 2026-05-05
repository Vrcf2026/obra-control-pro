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
  orc_cliente: number; orc_interno: number; gasto: number;
}

function Page() {
  const { role } = useAuth();
  // Encarregado is redirected to /encarregado
  useEffect(() => {
    if (role === "encarregado") window.location.replace("/encarregado");
  }, [role]);

  return (
    <Protected allow={["admin", "gestor", "encarregado"]}>
      <Dashboard />
    </Protected>
  );
}

function Dashboard() {
  const [rows, setRows] = useState<ObraRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: obras }, { data: rubricas }, { data: lanc }, { data: adendas }] = await Promise.all([
      supabase.from("obras").select("id,nome,cliente,estado").order("created_at", { ascending: false }),
      supabase.from("rubricas").select("id,obra_id,orcamento_cliente,orcamento_interno"),
      supabase.from("lancamentos").select("obra_id,valor"),
      supabase.from("adendas").select("obra_id,valor_cliente,valor_interno"),
    ]);

    const map = new Map<string, ObraRow>();
    (obras ?? []).forEach(o => map.set(o.id, {
      id: o.id, nome: o.nome, cliente: o.cliente, estado: o.estado,
      orc_cliente: 0, orc_interno: 0, gasto: 0,
    }));
    (rubricas ?? []).forEach(r => {
      const o = map.get(r.obra_id); if (!o) return;
      o.orc_cliente += Number(r.orcamento_cliente);
      o.orc_interno += Number(r.orcamento_interno);
    });
    (adendas ?? []).forEach(a => {
      const o = map.get(a.obra_id); if (!o) return;
      o.orc_cliente += Number(a.valor_cliente);
      o.orc_interno += Number(a.valor_interno);
    });
    (lanc ?? []).forEach(l => {
      const o = map.get(l.obra_id); if (!o) return;
      o.gasto += Number(l.valor);
    });

    setRows(Array.from(map.values()));
    setLoading(false);
  }

  const summary = useMemo(() => {
    const ativas = rows.filter(r => ["adjudicada", "em_curso"].includes(r.estado)).length;
    const margem = rows.reduce((s, r) => s + (r.orc_cliente - r.orc_interno), 0);
    const risco = rows.filter(r => {
      const desv = r.orc_interno - r.gasto;
      const ratio = r.orc_interno > 0 ? desv / r.orc_interno : 0;
      return ratio < -0.10;
    }).length;
    return { ativas, margem, risco };
  }, [rows]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão global das obras</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card icon={<Briefcase className="w-5 h-5" />} label="Obras activas" value={String(summary.ativas)} />
        <Card icon={<TrendingUp className="w-5 h-5" />} label="Margem prevista total" value={eur(summary.margem)} accent={summary.margem >= 0 ? "success" : "danger"} />
        <Card icon={<AlertTriangle className="w-5 h-5" />} label="Obras em risco" value={String(summary.risco)} accent={summary.risco > 0 ? "danger" : undefined} />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Obras</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">A carregar...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Sem obras. Crie em <Link to="/gestao" className="text-primary underline">Gestão</Link>.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Obra</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Orç. cliente</th>
                  <th className="text-right p-3">Gasto real</th>
                  <th className="text-left p-3 min-w-[140px]">Consumo interno</th>
                  <th className="text-center p-3">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const consumo = r.orc_interno > 0 ? (r.gasto / r.orc_interno) * 100 : 0;
                  const desvio = r.orc_interno - r.gasto;
                  const ratio = r.orc_interno > 0 ? desvio / r.orc_interno : 0;
                  const semClass = ratio >= 0 ? "bg-success" : ratio >= -0.1 ? "bg-warning" : "bg-danger";
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <Link to="/obras/$id" params={{ id: r.id }} className="font-medium text-foreground hover:text-primary">
                          {r.nome}
                        </Link>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.cliente}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${estadoColor[r.estado]}`}>
                          {estadoLabel[r.estado]}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{eur(r.orc_cliente)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${consumo > 100 ? "bg-danger" : consumo > 90 ? "bg-warning" : "bg-primary"}`}
                              style={{ width: `${Math.min(consumo, 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{consumo.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block w-3 h-3 rounded-full ${semClass}`} title={eur(desvio)} />
                      </td>
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

function Card({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "success" | "danger" }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${accent === "success" ? "text-success" : accent === "danger" ? "text-danger" : ""}`}>
        {value}
      </div>
    </div>
  );
}
