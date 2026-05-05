import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur, estadoLabel, estadoColor } from "@/lib/format";
import { DespesaPanel } from "@/components/DespesaPanel";
import { Plus, ArrowLeft, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/obras/$id")({ component: () => <Protected><Detalhe /></Protected> });

interface Rubrica { id: string; nome: string; orcamento_interno: number; gasto?: number }
interface Adenda { id: string; descricao: string; valor_cliente: number; valor_interno: number; data: string }
interface Obra {
  id: string; nome: string; cliente: string; localizacao: string | null; estado: string;
  data_inicio: string | null; data_fim_previsto: string | null; orcamento_cliente: number;
}

function Detalhe() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const canSpend = role === "admin" || role === "encarregado";
  const [obra, setObra] = useState<Obra | null>(null);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [adendas, setAdendas] = useState<Adenda[]>([]);
  const [showAdenda, setShowAdenda] = useState(false);
  const [showDespesa, setShowDespesa] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [{ data: o }, { data: r }, { data: l }, { data: a }] = await Promise.all([
      supabase.from("obras").select("*").eq("id", id).maybeSingle(),
      supabase.from("rubricas").select("*").eq("obra_id", id).order("created_at"),
      supabase.from("lancamentos").select("rubrica_id,valor").eq("obra_id", id),
      supabase.from("adendas").select("*").eq("obra_id", id).order("data", { ascending: false }),
    ]);
    setObra(o as unknown as Obra | null);
    const gastos = new Map<string, number>();
    (l ?? []).forEach(x => gastos.set(x.rubrica_id, (gastos.get(x.rubrica_id) ?? 0) + Number(x.valor)));
    setRubricas((r ?? []).map(x => ({ id: x.id, nome: x.nome, orcamento_interno: Number(x.orcamento_interno), gasto: gastos.get(x.id) ?? 0 })));
    setAdendas((a ?? []) as Adenda[]);
  }

  if (!obra) return <div className="p-8 text-muted-foreground">A carregar...</div>;

  const totGasto = rubricas.reduce((s, r) => s + (r.gasto ?? 0), 0);
  const totInterno = rubricas.reduce((s, r) => s + Number(r.orcamento_interno), 0);
  const adTot = adendas.reduce((s, a) => ({ cli: s.cli + Number(a.valor_cliente), int: s.int + Number(a.valor_interno) }), { cli: 0, int: 0 });
  const totalFaturavel = Number(obra.orcamento_cliente) + adTot.cli;
  const margem = totalFaturavel - (totInterno + adTot.int);
  const margemPct = totalFaturavel > 0 ? (margem / totalFaturavel) * 100 : 0;

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
            <span className={`text-xs px-2 py-1 rounded-md font-medium w-fit ${estadoColor[obra.estado]}`}>{estadoLabel[obra.estado]}</span>
            {canSpend && (
              <button onClick={() => setShowDespesa(true)} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
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
        {adTot.cli !== 0 && <Linha label="Adendas" value={`+${eur(adTot.cli)}`} className="text-primary" />}
        <Linha label="Total faturável" value={eur(totalFaturavel)} bold />
        <div className="border-t border-border my-2" />
        <Linha label="Orçamento interno" value={eur(totInterno + adTot.int)} />
        <Linha label="Margem prevista" value={`${eur(margem)} · ${margemPct.toFixed(1)}%`} className={margem >= 0 ? "text-success" : "text-danger"} bold />
      </div>

      {/* Rubricas */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-medium">Rubricas</h2>
          {isAdmin && <Link to="/gestao/obras/$id" params={{ id }} className="text-sm text-primary">Editar orçamento</Link>}
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
          {isAdmin && (
            <button onClick={() => setShowAdenda(true)} className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Nova adenda
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Descrição</th>
                <th className="text-right p-3">Valor cliente</th>
                <th className="text-right p-3">Valor interno</th>
              </tr>
            </thead>
            <tbody>
              {adendas.map(a => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-3 text-muted-foreground">{a.data}</td>
                  <td className="p-3">
                    <span className="inline-block text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary mr-2">Adenda</span>
                    {a.descricao}
                  </td>
                  <td className="p-3 text-right tabular-nums">{eur(a.valor_cliente)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(a.valor_interno)}</td>
                </tr>
              ))}
              {adendas.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem adendas.</td></tr>}
            </tbody>
            {adendas.length > 0 && (
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="p-3" colSpan={2}>Totais</td>
                  <td className="p-3 text-right tabular-nums">{eur(adTot.cli)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(adTot.int)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showAdenda && <AdendaModal obraId={id} onClose={() => setShowAdenda(false)} onSaved={() => { setShowAdenda(false); load(); }} />}
      {showDespesa && <DespesaPanel obraId={id} rubricas={rubricas} onClose={() => setShowDespesa(false)} onSaved={() => { setShowDespesa(false); load(); }} />}
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

function AdendaModal({ obraId, onClose, onSaved }: { obraId: string; onClose: () => void; onSaved: () => void }) {
  const [descricao, setDescricao] = useState("");
  const [vc, setVc] = useState("0");
  const [vi, setVi] = useState("0");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("adendas").insert({
      obra_id: obraId, descricao, valor_cliente: Number(vc), valor_interno: Number(vi), data,
    });
    if (error) toast.error(error.message); else { toast.success("Adenda criada"); onSaved(); }
  }

  return (
    <Modal title="Nova adenda" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Descrição"><input required value={descricao} onChange={e => setDescricao(e.target.value)} className="input" /></Field>
        <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor cliente (€)"><input type="number" step="0.01" value={vc} onChange={e => setVc(e.target.value)} className="input" /></Field>
          <Field label="Valor interno (€)"><input type="number" step="0.01" value={vi} onChange={e => setVi(e.target.value)} className="input" /></Field>
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </Modal>
  );
}

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
