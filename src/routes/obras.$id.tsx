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
interface AdendaRub { id: string; adenda_id: string; nome: string; valor: number }
interface Adenda { id: string; descricao: string; valor_cliente: number; data: string }
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
      supabase.from("lancamentos").select("rubrica_id,valor").eq("obra_id", id),
      supabase.from("adendas").select("*").eq("obra_id", id).order("data", { ascending: false }),
      supabase.from("faturas_emitidas").select("*").eq("obra_id", id).order("data", { ascending: false }),
    ]);
    setObra(o as unknown as Obra | null);
    const gastos = new Map<string, number>();
    (l ?? []).forEach(x => gastos.set(x.rubrica_id, (gastos.get(x.rubrica_id) ?? 0) + Number(x.valor)));
    setRubricas((r ?? []).map(x => ({ id: x.id, nome: x.nome, orcamento_interno: Number(x.orcamento_interno), gasto: gastos.get(x.id) ?? 0 })));
    const adArr = (a ?? []) as Adenda[];
    setAdendas(adArr);
    setFaturas(((f ?? []) as Fatura[]).map(x => ({ ...x, valor: Number(x.valor) })));
    if (adArr.length > 0) {
      const { data: ar } = await supabase.from("adenda_rubricas").select("*").in("adenda_id", adArr.map(x => x.id));
      setAdRubs(((ar ?? []) as AdendaRub[]).map(x => ({ ...x, valor: Number(x.valor) })));
    } else {
      setAdRubs([]);
    }
  }

  if (!obra) return <div className="p-8 text-muted-foreground">A carregar...</div>;

  const totGasto = rubricas.reduce((s, r) => s + (r.gasto ?? 0), 0);
  const totInterno = rubricas.reduce((s, r) => s + Number(r.orcamento_interno), 0);
  const adIntPorAdenda = (adId: string) =>
    adRubs.filter(r => r.adenda_id === adId).reduce((s, r) => s + Number(r.valor), 0);
  const adTotInt = adendas.reduce((s, a) => s + adIntPorAdenda(a.id), 0);
  const adTotCli = adendas.reduce((s, a) => s + Number(a.valor_cliente), 0);
  const totalFaturavel = Number(obra.orcamento_cliente) + adTotCli;
  const margemPrev = totalFaturavel - (totInterno + adTotInt);
  const margemPrevPct = totalFaturavel > 0 ? (margemPrev / totalFaturavel) * 100 : 0;
  const margemAtual = totalFaturavel - totGasto;
  const margemAtualPct = totalFaturavel > 0 ? (margemAtual / totalFaturavel) * 100 : 0;

  const totFaturado = faturas.reduce((s, f) => s + Number(f.valor), 0);
  const porFaturar = totalFaturavel - totFaturado;

  const podeDespesa = ALLOW.despesas.includes(obra.estado);
  const podeAdenda = ALLOW.adendas.includes(obra.estado);
  const podeEditar = ALLOW.editar.includes(obra.estado);
  const podeFatura = ALLOW.faturas.includes(obra.estado);

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
        <Linha label="Orçamento interno" value={eur(totInterno + adTotInt)} />
        <Linha label="Margem prevista" value={`${eur(margemPrev)} · ${margemPrevPct.toFixed(1)}%`} className={margemPrev >= 0 ? "text-success" : "text-danger"} bold />
        {totGasto > 0 && (
          <>
            <div className="border-t border-border my-2" />
            <Linha label="Gasto real até agora" value={eur(totGasto)} />
            <Linha label="Margem actual" value={`${eur(margemAtual)} · ${margemAtualPct.toFixed(1)}%`} className={margemAtual >= 0 ? "text-success" : "text-danger"} bold />
          </>
        )}
      </div>

      {/* Rubricas */}
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
                <th className="text-right p-3">Orç. interno</th>
                <th className="text-right p-3">Gasto real</th>
                <th className="text-right p-3">Desvio</th>
                <th className="text-right p-3">% Cons.</th>
              </tr>
            </thead>
            <tbody>
              {rubricas.map(r => {
                const desvio = Number(r.orcamento_interno) - (r.gasto ?? 0);
                const cons = r.orcamento_interno > 0 ? ((r.gasto ?? 0) / Number(r.orcamento_interno)) * 100 : 0;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-medium">{r.nome}</td>
                    <td className="p-3 text-right tabular-nums">{eur(r.orcamento_interno)}</td>
                    <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                    <td className={`p-3 text-right tabular-nums ${desvio < 0 ? "text-danger" : "text-success"}`}>{eur(desvio)}</td>
                    <td className="p-3 text-right tabular-nums">{cons.toFixed(0)}%</td>
                  </tr>
                );
              })}
              {rubricas.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem rubricas.</td></tr>}
            </tbody>
            {rubricas.length > 0 && (
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="p-3">Totais</td>
                  <td className="p-3 text-right tabular-nums">{eur(totInterno)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(totGasto)}</td>
                  <td className={`p-3 text-right tabular-nums ${totInterno - totGasto < 0 ? "text-danger" : "text-success"}`}>{eur(totInterno - totGasto)}</td>
                  <td className="p-3 text-right tabular-nums">{totInterno > 0 ? ((totGasto / totInterno) * 100).toFixed(0) : 0}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

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
                    <div className="font-medium">{a.descricao}</div>
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
          {isAdminGestor && (
            <button
              onClick={() => setShowFatura(true)}
              disabled={!podeFatura}
              title={podeFatura ? "" : `Não é possível faturar no estado "${estadoLabel[obra.estado]}"`}
              className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {showAdenda && <AdendaPanel obraId={id} onClose={() => setShowAdenda(false)} onSaved={() => { setShowAdenda(false); load(); }} />}
      {showDespesa && <DespesaPanel obraId={id} rubricas={rubricas} onClose={() => setShowDespesa(false)} onSaved={() => { setShowDespesa(false); load(); }} />}
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
function AdendaPanel({ obraId, onClose, onSaved }: { obraId: string; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [vc, setVc] = useState("0");
  const [linhas, setLinhas] = useState<{ nome: string; valor: string }[]>([{ nome: "", valor: "" }]);
  const valorRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    const { data: ad, error } = await supabase.from("adendas").insert({
      obra_id: obraId, descricao, data, valor_cliente: valorCli, valor_interno: totalInterno,
    }).select("id").single();
    if (error || !ad) { toast.error(error?.message ?? "Erro"); return; }
    const validas = linhas.filter(l => l.nome && Number(l.valor) > 0);
    if (validas.length > 0) {
      const { error: e2 } = await supabase.from("adenda_rubricas").insert(
        validas.map(l => ({ adenda_id: ad.id, nome: l.nome, valor: Number(l.valor) }))
      );
      if (e2) { toast.error(e2.message); return; }
    }
    toast.success("Adenda criada"); onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg h-full overflow-y-auto border-l border-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nova adenda</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <Field label="Descrição"><input value={descricao} onChange={e => setDescricao(e.target.value)} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className="input" /></Field>
          <Field label="Valor cliente (€)"><input type="number" step="0.01" value={vc} onChange={e => setVc(e.target.value)} className="input text-right" /></Field>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Rubricas internas</div>
          {linhas.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={l.nome} onChange={e => setLinha(i, { nome: e.target.value })} placeholder="Nome" className="input flex-1" />
              <input ref={el => { valorRefs.current[i] = el; }} type="number" step="0.01" placeholder="0,00"
                value={l.valor} onChange={e => setLinha(i, { valor: e.target.value })}
                onKeyDown={e => onValorKey(e, i)} className="input w-28 text-right" />
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
          <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className="input" /></Field>
          <Field label="Nº fatura"><input value={num} onChange={e => setNum(e.target.value)} className="input" /></Field>
        </div>
        <Field label="Descrição"><input value={desc} onChange={e => setDesc(e.target.value)} className="input" /></Field>
        <Field label="Valor (€)"><input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="input text-right" /></Field>

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
