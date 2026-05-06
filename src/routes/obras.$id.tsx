import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur, estadoLabel, estadoColor } from "@/lib/format";
import { DespesaPanel } from "@/components/DespesaPanel";
import { Plus, ArrowLeft, Receipt, FileText, X, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/obras/$id")({ component: () => <Protected><Detalhe /></Protected> });

interface Rubrica { id: string; nome: string; orcamento_interno: number; gasto?: number }
interface AdendaRub { id: string; adenda_id: string; nome: string; valor: number; gasto?: number }
interface Adenda { id: string; descricao: string; valor_cliente: number; data: string; tipo: "extra" | "principal" }
interface Fatura { id: string; data: string; num_fatura: string; descricao: string | null; valor: number }
interface Obra {
  id: string; nome: string; cliente: string; localizacao: string | null; estado: string;
  data_inicio: string | null; data_fim_previsto: string | null; orcamento_cliente: number;
}

// Regras por estado (visibilidade)
const ALLOW = {
  despesas: ["adjudicada", "em_curso"],
  adendas: ["adjudicada", "em_curso", "concluida"],
  editar: ["orcamentacao", "adjudicada", "em_curso"],
  faturas: ["adjudicada", "em_curso", "concluida"],
};
const ESTADOS = ["orcamentacao", "adjudicada", "em_curso", "concluida", "faturada"] as const;

function Detalhe() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isAdminGestor = role === "admin" || role === "gestor";
  const canSpendRole = role === "admin" || role === "encarregado";
  const [obra, setObra] = useState<Obra | null>(null);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [adRubs, setAdRubs] = useState<AdendaRub[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [showAdenda, setShowAdenda] = useState(false);
  const [editAdenda, setEditAdenda] = useState<Adenda | null>(null);
  const [showDespesa, setShowDespesa] = useState(false);
  const [showFatura, setShowFatura] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [{ data: o }, { data: r }, { data: l }, { data: a }, { data: f }] = await Promise.all([
      supabase.from("obras").select("*").eq("id", id).maybeSingle(),
      supabase.from("rubricas").select("*").eq("obra_id", id).order("created_at"),
      supabase.from("lancamentos").select("rubrica_id,adenda_rubrica_id,valor").eq("obra_id", id),
      supabase.from("adendas").select("*").eq("obra_id", id).order("data", { ascending: false }),
      supabase.from("faturas_emitidas").select("*").eq("obra_id", id).order("data", { ascending: false }),
    ]);
    setObra(o as unknown as Obra | null);
    const gastosRub = new Map<string, number>();
    const gastosAd = new Map<string, number>();
    (l ?? []).forEach((x: any) => {
      if (x.rubrica_id) gastosRub.set(x.rubrica_id, (gastosRub.get(x.rubrica_id) ?? 0) + Number(x.valor));
      if (x.adenda_rubrica_id) gastosAd.set(x.adenda_rubrica_id, (gastosAd.get(x.adenda_rubrica_id) ?? 0) + Number(x.valor));
    });
    setRubricas((r ?? []).map(x => ({ id: x.id, nome: x.nome, orcamento_interno: Number(x.orcamento_interno), gasto: gastosRub.get(x.id) ?? 0 })));
    const adArr = (a ?? []) as Adenda[];
    setAdendas(adArr);
    setFaturas(((f ?? []) as Fatura[]).map(x => ({ ...x, valor: Number(x.valor) })));
    if (adArr.length > 0) {
      const { data: ar } = await supabase.from("adenda_rubricas").select("*").in("adenda_id", adArr.map(x => x.id));
      setAdRubs(((ar ?? []) as AdendaRub[]).map(x => ({ ...x, valor: Number(x.valor), gasto: gastosAd.get(x.id) ?? 0 })));
    } else {
      setAdRubs([]);
    }
  }

  if (!obra) return <div className="p-8 text-muted-foreground">A carregar...</div>;

  const totGasto = rubricas.reduce((s, r) => s + (r.gasto ?? 0), 0) + adRubs.reduce((s, r) => s + (r.gasto ?? 0), 0);
  const totInternoBase = rubricas.reduce((s, r) => s + Number(r.orcamento_interno), 0);
  const adIntPorAdenda = (adId: string) =>
    adRubs.filter(r => r.adenda_id === adId).reduce((s, r) => s + Number(r.valor), 0);
  const adendasPrincipal = adendas.filter(a => a.tipo === "principal");
  const adendasExtra = adendas.filter(a => a.tipo === "extra");
  const adRubsPrincipal = adRubs.filter(r => adendasPrincipal.some(a => a.id === r.adenda_id));
  const adTotIntPrincipal = adRubsPrincipal.reduce((s, r) => s + Number(r.valor), 0);
  const adTotIntExtra = adRubs.filter(r => adendasExtra.some(a => a.id === r.adenda_id)).reduce((s, r) => s + Number(r.valor), 0);
  const adTotInt = adTotIntPrincipal + adTotIntExtra;
  const adTotCli = adendas.reduce((s, a) => s + Number(a.valor_cliente), 0);
  const totalFaturavel = Number(obra.orcamento_cliente) + adTotCli;
  const totInterno = totInternoBase + adTotInt;
  const margemPrev = totalFaturavel - totInterno;
  const margemPrevPct = totalFaturavel > 0 ? (margemPrev / totalFaturavel) * 100 : 0;
  const margemAtual = totalFaturavel - totGasto;
  const margemAtualPct = totalFaturavel > 0 ? (margemAtual / totalFaturavel) * 100 : 0;

  // Consolidação: rubricas iniciais + rubricas das adendas tipo "principal", agrupadas por nome
  const consolidado = new Map<string, { nome: string; orcInicial: number; adendas: number; gasto: number; rubricaIds: string[] }>();
  rubricas.forEach(r => {
    const key = r.nome.trim().toLowerCase();
    const cur = consolidado.get(key) ?? { nome: r.nome, orcInicial: 0, adendas: 0, gasto: 0, rubricaIds: [] };
    cur.orcInicial += Number(r.orcamento_interno);
    cur.gasto += r.gasto ?? 0;
    cur.rubricaIds.push(r.id);
    consolidado.set(key, cur);
  });
  adRubsPrincipal.forEach(r => {
    const key = r.nome.trim().toLowerCase();
    const cur = consolidado.get(key) ?? { nome: r.nome, orcInicial: 0, adendas: 0, gasto: 0, rubricaIds: [] };
    cur.adendas += Number(r.valor);
    cur.gasto += r.gasto ?? 0;
    consolidado.set(key, cur);
  });
  const consolidadoArr = Array.from(consolidado.values());
  const totConsInicial = consolidadoArr.reduce((s, x) => s + x.orcInicial, 0);
  const totConsAdendas = consolidadoArr.reduce((s, x) => s + x.adendas, 0);
  const totConsTotal = totConsInicial + totConsAdendas;
  const totConsGasto = consolidadoArr.reduce((s, x) => s + x.gasto, 0);

  const podeDespesa = ALLOW.despesas.includes(obra.estado);
  const podeAdenda = ALLOW.adendas.includes(obra.estado);
  const podeEditar = ALLOW.editar.includes(obra.estado);
  const podeFatura = ALLOW.faturas.includes(obra.estado);

  const totFaturado = faturas.reduce((s, f) => s + Number(f.valor), 0);
  const porFaturar = totalFaturavel - totFaturado;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{obra.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {obra.cliente}{obra.localizacao && ` · ${obra.localizacao}`}
              {obra.data_inicio && ` · ${obra.data_inicio}`}{obra.data_fim_previsto && ` → ${obra.data_fim_previsto}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <select
                value={obra.estado}
                onChange={async e => {
                  const novo = e.target.value;
                  const { error } = await supabase.from("obras").update({ estado: novo as any }).eq("id", obra.id);
                  if (error) toast.error(error.message);
                  else { toast.success("Estado actualizado"); load(); }
                }}
                className="text-sm border border-input rounded-md px-2 py-1 bg-background"
              >
                {ESTADOS.map(e => <option key={e} value={e}>{estadoLabel[e]}</option>)}
              </select>
            ) : (
              <span className={`text-xs px-2 py-1 rounded-md font-medium w-fit ${estadoColor[obra.estado]}`}>{estadoLabel[obra.estado]}</span>
            )}
            {canSpendRole && podeDespesa && (
              <button
                onClick={() => setShowDespesa(true)}
                className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1"
              >
                <Receipt className="w-4 h-4" /> Registar despesa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Orçamento */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-2">
        <h2 className="font-medium mb-2">Orçamento</h2>
        <Linha label="Orçamento cliente" value={eur(obra.orcamento_cliente)} />
        {adTotCli !== 0 && <Linha label="Adendas" value={`+${eur(adTotCli)}`} className="text-primary" />}
        <Linha label="Total faturável" value={eur(totalFaturavel)} bold />
        <div className="border-t border-border my-2" />
        <Linha label="Orçamento interno" value={eur(totInterno)} />
        <Linha label="Margem prevista" value={`${eur(margemPrev)} · ${margemPrevPct.toFixed(1)}%`} className={margemPrev >= 0 ? "text-success" : "text-danger"} bold />
        {totGasto > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <Linha label="Gasto real até agora" value={eur(totGasto)} />
            <Linha label="Margem actual" value={`${eur(margemAtual)} · ${margemAtualPct.toFixed(1)}%`} className={margemAtual >= 0 ? "text-success" : "text-danger"} bold />
          </>
        )}
      </div>

      {/* Rubricas consolidadas */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Rubricas</h2>
          {isAdmin && podeEditar && <Link to="/gestao/obras/$id" params={{ id }} className="text-sm text-primary">Editar orçamento</Link>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-right p-3">Orç. inicial</th>
                <th className="text-right p-3">+ Adendas</th>
                <th className="text-right p-3">Orç. total</th>
                <th className="text-right p-3">Gasto real</th>
                <th className="text-right p-3">Desvio</th>
                <th className="text-right p-3">% Cons.</th>
              </tr>
            </thead>
            <tbody>
              {consolidadoArr.map((r, i) => {
                const total = r.orcInicial + r.adendas;
                const desvio = total - r.gasto;
                const cons = total > 0 ? (r.gasto / total) * 100 : 0;
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3 font-medium">{r.nome}</td>
                    <td className="p-3 text-right tabular-nums">{eur(r.orcInicial)}</td>
                    <td className="p-3 text-right tabular-nums text-primary">{r.adendas > 0 ? `+${eur(r.adendas)}` : "—"}</td>
                    <td className="p-3 text-right tabular-nums font-medium">{eur(total)}</td>
                    <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                    <td className={`p-3 text-right tabular-nums ${desvio < 0 ? "text-danger" : "text-success"}`}>{eur(desvio)}</td>
                    <td className="p-3 text-right tabular-nums">{cons.toFixed(0)}%</td>
                  </tr>
                );
              })}
              {consolidadoArr.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem rubricas.</td></tr>}
            </tbody>
            {consolidadoArr.length > 0 && (
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="p-3">Totais</td>
                  <td className="p-3 text-right tabular-nums">{eur(totConsInicial)}</td>
                  <td className="p-3 text-right tabular-nums text-primary">{totConsAdendas > 0 ? `+${eur(totConsAdendas)}` : "—"}</td>
                  <td className="p-3 text-right tabular-nums">{eur(totConsTotal)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(totConsGasto)}</td>
                  <td className={`p-3 text-right tabular-nums ${totConsTotal - totConsGasto < 0 ? "text-danger" : "text-success"}`}>{eur(totConsTotal - totConsGasto)}</td>
                  <td className="p-3 text-right tabular-nums">{totConsTotal > 0 ? ((totConsGasto / totConsTotal) * 100).toFixed(0) : 0}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Trabalho extra */}
      {adendasExtra.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <h2 className="font-medium">Trabalho extra</h2>
            <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{adendasExtra.length}</span>
          </div>
          <div className="p-5 space-y-4">
            {adendasExtra.map(a => {
              const subs = adRubs.filter(r => r.adenda_id === a.id);
              const intTot = subs.reduce((s, r) => s + Number(r.valor), 0);
              return (
                <div key={a.id} className="border border-border rounded-md">
                  <div className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{a.descricao}</div>
                      <div className="text-xs text-muted-foreground">{a.data}</div>
                    </div>
                    <div className="text-sm text-primary tabular-nums whitespace-nowrap">Valor cliente: {eur(a.valor_cliente)}</div>
                  </div>
                  {subs.length > 0 && (
                    <table className="w-full text-sm border-t border-border">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr><th className="text-left p-2">Rubrica</th><th className="text-right p-2">Orç. interno</th></tr>
                      </thead>
                      <tbody>
                        {subs.map(s => (
                          <tr key={s.id} className="border-t border-border">
                            <td className="p-2">{s.nome}</td>
                            <td className="p-2 text-right tabular-nums">{eur(s.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 font-medium">
                        <tr><td className="p-2">Total interno</td><td className="p-2 text-right tabular-nums">{eur(intTot)}</td></tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Adendas */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Adendas</h2>
          {isAdmin && podeAdenda && (
            <button
              onClick={() => { setEditAdenda(null); setShowAdenda(true); }}
              className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Nova adenda
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          {adendas.length === 0 && <div className="p-6 text-center text-muted-foreground">Sem adendas.</div>}
          {adendas.map(a => {
            const subs = adRubs.filter(r => r.adenda_id === a.id);
            const intTot = subs.reduce((s, r) => s + Number(r.valor), 0);
            const m = Number(a.valor_cliente) - intTot;
            const mp = a.valor_cliente > 0 ? (m / Number(a.valor_cliente)) * 100 : 0;
            return (
              <div key={a.id} className="border border-border rounded-md">
                <div className="flex items-start justify-between p-3 gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{a.data}</div>
                    <div className="font-medium flex items-center gap-2">
                      {a.descricao}
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${a.tipo === "principal" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                        {a.tipo === "principal" ? "Incluída no principal" : "Trabalho extra"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-primary tabular-nums">Valor cliente: {eur(a.valor_cliente)}</div>
                  </div>
                  {isAdmin && podeAdenda && (
                    <button onClick={() => { setEditAdenda(a); setShowAdenda(true); }} className="text-muted-foreground hover:text-foreground" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {subs.length > 0 && (
                  <table className="w-full text-sm border-t border-border">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr><th className="text-left p-2">Rubrica interna</th><th className="text-right p-2">Valor</th></tr>
                    </thead>
                    <tbody>
                      {subs.map(s => (
                        <tr key={s.id} className="border-t border-border">
                          <td className="p-2">{s.nome}</td>
                          <td className="p-2 text-right tabular-nums">{eur(s.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="border-t border-border p-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total interno</span><span className="tabular-nums">{eur(intTot)}</span></div>
                  <div className={`flex justify-between font-semibold ${m >= 0 ? "text-success" : "text-danger"}`}>
                    <span>Margem</span><span className="tabular-nums">{eur(m)} · {mp.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Faturação */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Faturação</h2>
          {isAdminGestor && podeFatura && (
            <button
              onClick={() => setShowFatura(true)}
              className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md inline-flex items-center gap-1"
            >
              <FileText className="w-4 h-4" /> Registar fatura
            </button>
          )}
        </div>
        <div className="p-5 space-y-2">
          <Linha label="Total faturável" value={eur(totalFaturavel)} />
          <Linha label="Já faturado" value={eur(totFaturado)} />
          <div className="border-t border-border my-1" />
          <Linha label="Por faturar" value={eur(porFaturar)} className={porFaturar < 0 ? "text-danger" : ""} bold />
        </div>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Nº Fatura</th>
                <th className="text-left p-3">Descrição</th>
                <th className="text-right p-3">Valor</th>
                {isAdmin && <th className="p-3"></th>}
              </tr>
            </thead>
            <tbody>
              {faturas.map(f => (
                <tr key={f.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground">{f.data}</td>
                  <td className="p-3 font-medium">{f.num_fatura}</td>
                  <td className="p-3">{f.descricao || "—"}</td>
                  <td className="p-3 text-right tabular-nums">{eur(f.valor)}</td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm("Apagar fatura?")) return;
                          const { error } = await supabase.from("faturas_emitidas").delete().eq("id", f.id);
                          if (error) toast.error(error.message); else { toast.success("Fatura apagada"); load(); }
                        }}
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {faturas.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="p-6 text-center text-muted-foreground">Sem faturas emitidas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showAdenda && <AdendaPanel obraId={id} adenda={editAdenda} onClose={() => { setShowAdenda(false); setEditAdenda(null); }} onSaved={() => { setShowAdenda(false); setEditAdenda(null); load(); }} />}
      {showDespesa && (
        <DespesaPanel
          obraId={id}
          rubricas={[
            ...rubricas.map(r => ({ id: r.id, nome: r.nome, origem: "Orçamento" })),
            ...adRubs.map(r => {
              const ad = adendas.find(a => a.id === r.adenda_id);
              return { id: r.id, nome: r.nome, origem: `Adenda: ${ad?.descricao ?? ""}` };
            }),
          ]}
          onClose={() => setShowDespesa(false)}
          onSaved={() => { setShowDespesa(false); load(); }}
        />
      )}
      {showFatura && <FaturaPanel obraId={id} onClose={() => setShowFatura(false)} onSaved={() => { setShowFatura(false); load(); }} />}
    </div>
  );
}

function Linha({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between items-center text-sm ${bold ? "font-semibold" : ""} ${className ?? ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ===== Adenda Panel (slide-in com rubricas internas) =====
function AdendaPanel({ obraId, adenda, onClose, onSaved }: { obraId: string; adenda: Adenda | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!adenda;
  const [descricao, setDescricao] = useState(adenda?.descricao ?? "");
  const [data, setData] = useState(adenda?.data ?? new Date().toISOString().slice(0, 10));
  const [vc, setVc] = useState(adenda ? String(adenda.valor_cliente) : "0");
  const [tipo, setTipo] = useState<"extra" | "principal">(adenda?.tipo ?? "extra");
  const [linhas, setLinhas] = useState<{ nome: string; valor: string }[]>([{ nome: "", valor: "" }]);
  const valorRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!adenda) return;
    supabase.from("adenda_rubricas").select("nome,valor").eq("adenda_id", adenda.id).then(({ data }) => {
      if (data && data.length > 0) setLinhas(data.map(r => ({ nome: r.nome, valor: String(r.valor) })));
    });
  }, [adenda]);

  function setLinha(i: number, patch: Partial<{ nome: string; valor: string }>) {
    setLinhas(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLinha() {
    setLinhas(ls => [...ls, { nome: "", valor: "" }]);
    setTimeout(() => valorRefs.current[linhas.length]?.focus(), 0);
  }
  function removeLinha(i: number) { setLinhas(ls => ls.filter((_, idx) => idx !== i)); }
  function onValorKey(e: React.KeyboardEvent, i: number) {
    if (e.key === "Enter") { e.preventDefault(); if (i === linhas.length - 1) addLinha(); else valorRefs.current[i + 1]?.focus(); }
  }

  const totalInterno = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const valorCli = Number(vc) || 0;
  const margem = valorCli - totalInterno;
  const margemPct = valorCli > 0 ? (margem / valorCli) * 100 : 0;

  async function save() {
    if (!descricao) { toast.error("Indique a descrição"); return; }
    let adId = adenda?.id;
    if (isEdit && adId) {
      const { error } = await supabase.from("adendas").update({ descricao, data, valor_cliente: valorCli, tipo }).eq("id", adId);
      if (error) { toast.error(error.message); return; }
      await supabase.from("adenda_rubricas").delete().eq("adenda_id", adId);
    } else {
      const { data: ad, error } = await supabase.from("adendas").insert({
        obra_id: obraId, descricao, data, valor_cliente: valorCli, tipo,
      }).select("id").single();
      if (error || !ad) { toast.error(error?.message ?? "Erro"); return; }
      adId = ad.id;
    }
    const validas = linhas.filter(l => l.nome && Number(l.valor) > 0);
    if (validas.length > 0 && adId) {
      const { error: e2 } = await supabase.from("adenda_rubricas").insert(
        validas.map(l => ({ adenda_id: adId!, nome: l.nome, valor: Number(l.valor) }))
      );
      if (e2) { toast.error(e2.message); return; }
    }
    toast.success(isEdit ? "Adenda actualizada" : "Adenda criada"); onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg h-full overflow-y-auto border-l border-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? "Editar adenda" : "Nova adenda"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <Field label="Descrição"><input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" /></Field>
          <Field label="Valor cliente (€)"><input type="number" step="0.01" value={vc} onChange={e => setVc(e.target.value)} className="w-28 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary text-right" /></Field>
        </div>

        <Field label="Tipo de adenda">
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "extra", t: "Trabalho extra", s: "Aparece separado na obra" },
              { v: "principal", t: "Incluir no principal", s: "Junta às rubricas do orçamento" },
            ] as const).map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setTipo(opt.v)}
                className={`text-left border rounded-md px-3 py-2 text-sm transition-colors ${
                  tipo === opt.v
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="font-medium">{opt.t}</div>
                <div className="text-xs opacity-80">{opt.s}</div>
              </button>
            ))}
          </div>
        </Field>

        <div className="space-y-2">
          <div className="text-sm font-medium">Rubricas internas</div>
          {linhas.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={l.nome} onChange={e => setLinha(i, { nome: e.target.value })} placeholder="Nome" className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary flex-1" />
              <input ref={el => { valorRefs.current[i] = el; }} type="number" step="0.01" placeholder="0,00"
                value={l.valor} onChange={e => setLinha(i, { valor: e.target.value })}
                onKeyDown={e => onValorKey(e, i)} className="w-28 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary text-right" />
              <button onClick={() => removeLinha(i)} className="text-muted-foreground hover:text-danger"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addLinha} className="text-sm text-primary inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Adicionar linha</button>
        </div>

        <div className="border-t border-border pt-3 space-y-1">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total interno</span><span className="tabular-nums">{eur(totalInterno)}</span></div>
          <div className={`flex justify-between text-sm font-semibold ${margem >= 0 ? "text-success" : "text-danger"}`}>
            <span>Margem da adenda</span><span className="tabular-nums">{eur(margem)} · {margemPct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={save} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar</button>
        </div>

        <style>{`.input{width:100%;border:1px solid var(--input);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px}`}</style>
      </div>
    </div>
  );
}

// ===== Fatura Panel (slide-in) =====
function FaturaPanel({ obraId, onClose, onSaved }: { obraId: string; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [num, setNum] = useState("");
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("0");

  async function save() {
    if (!num) { toast.error("Indique o nº da fatura"); return; }
    const { error } = await supabase.from("faturas_emitidas").insert({
      obra_id: obraId, data, num_fatura: num, descricao: desc || null, valor: Number(valor),
    });
    if (error) toast.error(error.message); else { toast.success("Fatura registada"); onSaved(); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg h-full overflow-y-auto border-l border-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Registar fatura</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" /></Field>
          <Field label="Nº fatura"><input value={num} onChange={e => setNum(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" /></Field>
        </div>
        <Field label="Descrição"><input value={desc} onChange={e => setDesc(e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" /></Field>
        <Field label="Valor (€)"><input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="w-28 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary text-right" /></Field>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={save} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar</button>
        </div>

        <style>{`.input{width:100%;border:1px solid var(--input);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px}`}</style>
      </div>
    </div>
  );
}

// ===== Modal helpers (re-exported para outros ficheiros) =====
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg w-full max-w-md p-6 border border-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
      <style>{`.input{width:100%;border:1px solid var(--input);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px}`}</style>
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
export function ModalActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
      <button type="submit" className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar</button>
    </div>
  );
}
