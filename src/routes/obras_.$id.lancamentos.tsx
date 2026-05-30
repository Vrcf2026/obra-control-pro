import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur } from "@/lib/format";
import { DespesaPanel } from "@/components/DespesaPanel";
import { ArrowLeft, Receipt, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/obras_/$id/lancamentos")({
  component: () => <Protected><Page /></Protected>,
});

interface LinhaRaw {
  id: string;
  data: string;
  fornecedor: string | null;
  descricao: string;
  valor: number;
  rubrica_id: string | null;
  adenda_rubrica_id: string | null;
  rubrica_nome: string | null;
  registado_por: string | null;
  created_at: string;
}

interface Grupo {
  key: string;        // group by (data|fornecedor|descricao|registado_por|created_minute)
  data: string;
  fornecedor: string | null;
  descricao: string;
  registado_por: string | null;
  linhas: (LinhaRaw & { rubricaLabel: string })[];
  total: number;
}

function Page() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isEncarregado = role === "encarregado";
  const canSpend = isAdmin || isEncarregado;

  const [obraNome, setObraNome] = useState("");
  const [rubricas, setRubricas] = useState<Array<{ id: string; nome: string; origem: string }>>([]);
  const [linhas, setLinhas] = useState<LinhaRaw[]>([]);
  const [showDespesa, setShowDespesa] = useState(false);
  const [editGrupo, setEditGrupo] = useState<Grupo | null>(null);
  const [delGrupo, setDelGrupo] = useState<Grupo | null>(null);

  // filtros
  const [fForn, setFForn] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fRub, setFRub] = useState<string>("");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  useEffect(() => { load(); }, [id]);

  async function load() {
    const [{ data: o }, { data: r }, { data: ad }, { data: ar }, { data: l }] = await Promise.all([
      supabase.from("obras").select("nome").eq("id", id).maybeSingle(),
      supabase.from("rubricas").select("id,nome").eq("obra_id", id),
      supabase.from("adendas").select("id,descricao").eq("obra_id", id),
      supabase.from("adenda_rubricas").select("id,nome,adenda_id"),
      supabase.from("lancamentos").select("*").eq("obra_id", id).order("data", { ascending: false }),
    ]);
    setObraNome((o as any)?.nome ?? "");
    const adendaMap = new Map<string, string>((ad ?? []).map((x: any) => [x.id, x.descricao]));
    const rubs: Array<{ id: string; nome: string; origem: string }> = [
      ...((r ?? []) as any[]).map(x => ({ id: x.id, nome: x.nome, origem: "Orçamento" })),
      ...((ar ?? []) as any[])
        .filter(x => (ad ?? []).some((a: any) => a.id === x.adenda_id) &&
                     (ad ?? []).find((a: any) => a.id === x.adenda_id))
        .filter(x => true)
        .map(x => ({ id: x.id, nome: x.nome, origem: `Adenda: ${adendaMap.get(x.adenda_id) ?? ""}` })),
    ];
    // restrict adenda rubricas to this obra
    const obraAdendaIds = new Set((ad ?? []).map((x: any) => x.id));
    const arsObra = ((ar ?? []) as any[]).filter(x => obraAdendaIds.has(x.adenda_id));
    setRubricas([
      ...((r ?? []) as any[]).map(x => ({ id: x.id, nome: x.nome, origem: "Orçamento" })),
      ...arsObra.map(x => ({ id: x.id, nome: x.nome, origem: `Adenda: ${adendaMap.get(x.adenda_id) ?? ""}` })),
    ]);
    setLinhas(((l ?? []) as any[]).map(x => ({ ...x, valor: Number(x.valor) })));
  }

  const rubricaLabel = (lin: LinhaRaw): string => {
    if (lin.rubrica_id) return rubricas.find(r => r.id === lin.rubrica_id)?.nome ?? "—";
    if (lin.adenda_rubrica_id) return rubricas.find(r => r.id === lin.adenda_rubrica_id)?.nome ?? "—";
    return lin.rubrica_nome ?? "Avulsa";
  };

  // agrupar lançamentos por (created_at + data + fornecedor + descricao + registado_por)
  // como cada "registo de despesa" insere várias rubricas com mesma data/forn/desc, agrupar por chave composta
  const grupos: Grupo[] = useMemo(() => {
    const map = new Map<string, Grupo>();
    linhas.forEach(l => {
      const key = `${l.created_at}|${l.data}|${l.fornecedor ?? ""}|${l.descricao}|${l.registado_por ?? ""}`;
      const cur = map.get(key) ?? {
        key, data: l.data, fornecedor: l.fornecedor, descricao: l.descricao,
        registado_por: l.registado_por, linhas: [], total: 0,
      };
      cur.linhas.push({ ...l, rubricaLabel: rubricaLabel(l) });
      cur.total += l.valor;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data));
  }, [linhas, rubricas]);

  const filtrados = grupos.filter(g => {
    if (fForn && !(g.fornecedor ?? "").toLowerCase().includes(fForn.toLowerCase())) return false;
    if (fDesc && !g.descricao.toLowerCase().includes(fDesc.toLowerCase())) return false;
    if (fRub) {
      if (fRub === "__avulsa__") {
        if (!g.linhas.some(l => !l.rubrica_id && !l.adenda_rubrica_id)) return false;
      } else {
        if (!g.linhas.some(l => l.rubrica_id === fRub || l.adenda_rubrica_id === fRub)) return false;
      }
    }
    if (fDe && g.data < fDe) return false;
    if (fAte && g.data > fAte) return false;
    return true;
  });

  const total = filtrados.reduce((s, g) => s + g.total, 0);

  function podeEditar(g: Grupo) {
    if (isAdmin) return true;
    if (isEncarregado && g.registado_por === user?.id) return true;
    return false;
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link to="/obras/$id" params={{ id }} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> {obraNome || "Voltar"}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Lançamentos</h1>
          {canSpend && (
            <button onClick={() => setShowDespesa(true)}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
              <Receipt className="w-4 h-4" /> Registar despesa
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input placeholder="Fornecedor" value={fForn} onChange={e => setFForn(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background" />
        <input placeholder="Descrição" value={fDesc} onChange={e => setFDesc(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background" />
        <select value={fRub} onChange={e => setFRub(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">Todas as rubricas</option>
          {rubricas.map(r => <option key={r.id} value={r.id}>{r.nome} ({r.origem})</option>)}
          <option value="__avulsa__">Avulsa</option>
        </select>
        <input type="date" value={fDe} onChange={e => setFDe(e.target.value)}
          className="border border-border rounded-md px-3 py-2 text-sm bg-background" />
        <div className="flex gap-2">
          <input type="date" value={fAte} onChange={e => setFAte(e.target.value)}
            className="border border-border rounded-md px-3 py-2 text-sm bg-background flex-1" />
          <button onClick={() => { setFForn(""); setFDesc(""); setFRub(""); setFDe(""); setFAte(""); }}
            className="text-sm border border-input rounded-md px-3">Limpar</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Fornecedor</th>
                <th className="text-left p-3">Descrição/Fatura</th>
                <th className="text-left p-3">Rubricas</th>
                <th className="text-right p-3">Valor total</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(g => (
                <tr key={g.key} className="border-t border-border">
                  <td className="p-3 text-muted-foreground tabular-nums">{g.data}</td>
                  <td className="p-3">{g.fornecedor || "—"}</td>
                  <td className="p-3">
                    <button onClick={() => setEditGrupo(g)} className="hover:underline text-left">
                      {g.descricao || "—"}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {g.linhas.map(l => (
                        <span key={l.id} className={`text-xs px-2 py-0.5 rounded-md ${
                          !l.rubrica_id && !l.adenda_rubrica_id
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-foreground"
                        }`}>{l.rubricaLabel}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium">{eur(g.total)}</td>
                  <td className="p-3 text-right">
                    {podeEditar(g) && (
                      <button onClick={() => setEditGrupo(g)} className="text-muted-foreground hover:text-foreground" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem lançamentos.</td></tr>
              )}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td colSpan={4} className="p-3">Total</td>
                  <td className="p-3 text-right tabular-nums">{eur(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showDespesa && (
        <DespesaPanel obraId={id} rubricas={rubricas}
          onClose={() => setShowDespesa(false)}
          onSaved={() => { setShowDespesa(false); load(); }} />
      )}

      {editGrupo && (
        <EditPanel
          grupo={editGrupo}
          podeEditar={podeEditar(editGrupo)}
          onClose={() => setEditGrupo(null)}
          onSaved={() => { setEditGrupo(null); load(); }}
          onDelete={() => { setDelGrupo(editGrupo); setEditGrupo(null); }}
        />
      )}

      <PasswordConfirmDialog
        open={!!delGrupo}
        title="Apagar lançamento"
        description="Esta acção é irreversível. Confirme com a sua password."
        onClose={() => setDelGrupo(null)}
        onConfirmed={async () => {
          if (!delGrupo) return;
          const ids = delGrupo.linhas.map(l => l.id);
          const { error } = await supabase.from("lancamentos").delete().in("id", ids);
          if (error) toast.error(error.message); else { toast.success("Lançamento apagado"); load(); }
        }}
      />
    </div>
  );
}

function EditPanel({ grupo, podeEditar, onClose, onSaved, onDelete }: {
  grupo: Grupo; podeEditar: boolean; onClose: () => void; onSaved: () => void; onDelete: () => void;
}) {
  const [data, setData] = useState(grupo.data);
  const [fornecedor, setFornecedor] = useState(grupo.fornecedor ?? "");
  const [descricao, setDescricao] = useState(grupo.descricao);
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(grupo.linhas.map(l => [l.id, String(l.valor)]))
  );

  const total = Object.values(valores).reduce((s, v) => s + (Number(v) || 0), 0);

  async function save() {
    const updates = grupo.linhas.map(l =>
      supabase.from("lancamentos").update({
        data, fornecedor: fornecedor || null, descricao,
        valor: Number(valores[l.id]) || 0,
      }).eq("id", l.id)
    );
    const results = await Promise.all(updates);
    const err = results.find(r => r.error)?.error;
    if (err) toast.error(err.message); else { toast.success("Lançamento actualizado"); onSaved(); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg h-full overflow-y-auto border-l border-border p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{podeEditar ? "Editar lançamento" : "Lançamento"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-sm text-muted-foreground">Data</span>
            <input type="date" value={data} disabled={!podeEditar}
              onChange={e => setData(e.target.value)}
              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-60" />
          </label>
          <label className="block"><span className="text-sm text-muted-foreground">Fornecedor</span>
            <input value={fornecedor} disabled={!podeEditar}
              onChange={e => setFornecedor(e.target.value)}
              className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-60" />
          </label>
        </div>
        <label className="block"><span className="text-sm text-muted-foreground">Descrição / Nº fatura</span>
          <input value={descricao} disabled={!podeEditar}
            onChange={e => setDescricao(e.target.value)}
            className="mt-1 w-full border border-border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-60" />
        </label>

        <div className="space-y-2">
          <div className="text-sm font-medium">Linhas</div>
          {grupo.linhas.map(l => (
            <div key={l.id} className="flex gap-2 items-center">
              <div className="flex-1 text-sm px-3 py-2 bg-muted/40 rounded-md">{l.rubricaLabel}</div>
              <input type="number" step="0.01" value={valores[l.id]} disabled={!podeEditar}
                onChange={e => setValores(v => ({ ...v, [l.id]: e.target.value }))}
                className="w-28 border border-border rounded-md px-3 py-2 text-sm bg-background text-right disabled:opacity-60" />
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{eur(total)}</span>
        </div>

        {podeEditar && (
          <div className="flex justify-between gap-2 pt-2">
            <button onClick={onDelete}
              className="px-3 py-2 text-sm rounded-md border border-danger text-danger hover:bg-danger/10 inline-flex items-center gap-1">
              <Trash2 className="w-4 h-4" /> Apagar lançamento
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
              <button onClick={save} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar alterações</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
