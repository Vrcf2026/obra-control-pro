import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { eur, estadoLabel, estadoColor } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/gestao_/colaboradores_/$id")({
  component: () => <Protected allow={["admin"]}><Page /></Protected>,
});

interface Colab { id: string; nome: string; cargo: string | null; email: string | null; telefone: string | null }
interface ObraRow { id: string; nome: string; estado: string; orc_cliente: number; ad_cli: number; gasto: number }

function Page() {
  const { id } = Route.useParams();
  const [colab, setColab] = useState<Colab | null>(null);
  const [rows, setRows] = useState<ObraRow[]>([]);

  async function load() {
    const { data: c } = await (supabase.from("colaboradores") as any).select("*").eq("id", id).maybeSingle();
    setColab(c ?? null);

    const { data: obras } = await supabase.from("obras").select("id,nome,estado,orcamento_cliente")
      .eq("responsavel_interno_id" as any, id).order("created_at", { ascending: false }) as any;

    const ids = (obras ?? []).map((o: any) => o.id);
    if (ids.length === 0) { setRows([]); return; }

    const [{ data: lan }, { data: ad }] = await Promise.all([
      supabase.from("lancamentos").select("obra_id,valor").in("obra_id", ids),
      supabase.from("adendas").select("id,obra_id,valor_cliente").in("obra_id", ids),
    ]);

    const map = new Map<string, ObraRow>();
    (obras ?? []).forEach((o: any) => map.set(o.id, {
      id: o.id, nome: o.nome, estado: o.estado,
      orc_cliente: Number(o.orcamento_cliente), ad_cli: 0, gasto: 0,
    }));
    (ad ?? []).forEach((a: any) => { const o = map.get(a.obra_id); if (o) o.ad_cli += Number(a.valor_cliente); });
    (lan ?? []).forEach((l: any) => { const o = map.get(l.obra_id); if (o) o.gasto += Number(l.valor); });
    setRows(Array.from(map.values()));
  }

  useEffect(() => { load(); }, [id]);

  const totFat = rows.reduce((s, r) => s + r.orc_cliente + r.ad_cli, 0);
  const totGasto = rows.reduce((s, r) => s + r.gasto, 0);
  const margem = totFat > 0 ? ((totFat - totGasto) / totFat) * 100 : 0;

  if (!colab) return <div className="p-8 text-muted-foreground">A carregar...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <Link to="/gestao/colaboradores" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Colaboradores
      </Link>

      <div className="bg-card border border-border rounded-lg p-5">
        <h1 className="text-2xl font-semibold">{colab.nome}</h1>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
          {colab.cargo && <span>{colab.cargo}</span>}
          {colab.email && <span>{colab.email}</span>}
          {colab.telefone && <span>{colab.telefone}</span>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h2 className="font-medium">Obras</h2></div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Sem obras associadas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Orc. cliente</th>
                  <th className="text-right p-3">Total faturável</th>
                  <th className="text-right p-3">Gasto real</th>
                  <th className="text-right p-3">Margem %</th>
                  <th className="p-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const fat = r.orc_cliente + r.ad_cli;
                  const mar = fat > 0 ? ((fat - r.gasto) / fat) * 100 : 0;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3">
                        <Link to="/obras/$id" params={{ id: r.id }} className="font-medium hover:underline text-primary">
                          {r.nome}
                        </Link>
                      </td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColor[r.estado] ?? ""}`}>
                          {estadoLabel[r.estado] ?? r.estado}
                        </span>
                      </td>
                      <td className="p-3 text-right tabular-nums">{eur(r.orc_cliente)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(fat)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                      <td className="p-3 text-right tabular-nums">{mar.toFixed(1)}%</td>
                      <td className="p-3 text-center">
                        <span className={`w-2 h-2 rounded-full inline-block ${mar >= 10 ? "bg-success" : mar >= 0 ? "bg-amber-400" : "bg-danger"}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td colSpan={3} className="p-3">Totais</td>
                  <td className="p-3 text-right tabular-nums">{eur(totFat)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(totGasto)}</td>
                  <td className="p-3 text-right tabular-nums">{margem.toFixed(1)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
