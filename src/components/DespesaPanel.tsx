import { useEffect, useRef, useState, type ReactElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { eur } from "@/lib/format";
import { Plus, X, Check, Minus } from "lucide-react";
import { toast } from "sonner";

interface Rubrica {
  id: string;
  nome: string;
  origem: string;
  parent_id?: string | null;
}
interface Linha {
  tipo: "rubrica" | "avulsa";
  rubrica_id: string;
  avulsa_nome: string;
  valor: string;
  negativo: boolean;
}
interface Padrao {
  id: string;
  nome: string;
  parent_id: string | null;
}

const CUSTOM_TOKEN = "__custom__";
const AVULSA_TOKEN = "__avulsa__";

export function DespesaPanel({
  obraId,
  rubricas: rubricasInit,
  onClose,
  onSaved,
}: {
  obraId: string;
  rubricas: Rubrica[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [rubricas, setRubricas] = useState<Rubrica[]>(rubricasInit);
  const [padroes, setPadroes] = useState<Padrao[]>([]);
  const [customForLine, setCustomForLine] = useState<number | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedor, setFornecedor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([
    {
      tipo: "rubrica",
      rubrica_id: rubricasInit[0]?.id ?? "",
      avulsa_nome: "",
      valor: "",
      negativo: false,
    },
  ]);
  const valorRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    supabase
      .from("rubricas_padrao")
      .select("id,nome,parent_id")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        setPadroes((data ?? []) as any as Padrao[]);
      });
  }, []);

  function renderRubricaOptions(rubricasList: Rubrica[]) {
    const parents = rubricasList.filter((r) => !r.parent_id);
    const children = rubricasList.filter((r) => r.parent_id);
    const result: ReactElement[] = [];
    parents.forEach((p) => {
      result.push(
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>,
      );
      children
        .filter((c) => c.parent_id === p.id)
        .forEach((c) => {
          result.push(
            <option key={c.id} value={c.id}>
              &nbsp;&nbsp;&nbsp;↳ {c.nome}
            </option>,
          );
        });
    });
    const parentIds = new Set(parents.map((p) => p.id));
    children
      .filter((c) => !parentIds.has(c.parent_id!))
      .forEach((c) => {
        result.push(
          <option key={c.id} value={c.id}>
            &nbsp;&nbsp;&nbsp;↳ {c.nome}
          </option>,
        );
      });
    return result;
  }

  async function criarPersonalizada(i: number, nome: string) {
    const trimmed = nome.trim();
    if (!trimmed) return;
    const { data: nova, error } = await supabase
      .from("rubricas")
      .insert({ obra_id: obraId, nome: trimmed, orcamento_interno: 0 })
      .select("id,nome")
      .single();
    if (error || !nova) {
      toast.error(error?.message ?? "Erro");
      return;
    }
    const novaRub: Rubrica = { id: nova.id, nome: nova.nome, origem: "Orçamento" };
    setRubricas((rs) => [...rs, novaRub]);
    setLinha(i, { tipo: "rubrica", rubrica_id: nova.id });
    setCustomForLine(null);
    setCustomDraft("");
  }

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLinha() {
    setLinhas((ls) => [
      ...ls,
      { tipo: "rubrica", rubrica_id: rubricas[0]?.id ?? "", avulsa_nome: "", valor: "", negativo: false },
    ]);
    setTimeout(() => valorRefs.current[linhas.length]?.focus(), 0);
  }
  function removeLinha(i: number) {
    setLinhas((ls) => ls.filter((_, idx) => idx !== i));
  }

  function onValorKey(e: React.KeyboardEvent, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === linhas.length - 1) addLinha();
      else valorRefs.current[i + 1]?.focus();
    }
  }

  const total = linhas.reduce((s, l) => {
    const v = Number(l.valor) || 0;
    return s + (l.negativo ? -v : v);
  }, 0);

  async function save() {
    if (!user) return;
    const valid = linhas.filter(
      (l) => Number(l.valor) > 0 && (l.tipo === "rubrica" ? l.rubrica_id : l.avulsa_nome.trim()),
    );
    if (valid.length === 0) {
      toast.error("Adicione pelo menos uma linha com valor");
      return;
    }
    const rows = valid.map((l) => {
      const valorFinal = l.negativo ? -Number(l.valor) : Number(l.valor);
      if (l.tipo === "avulsa") {
        return {
          obra_id: obraId,
          rubrica_id: null,
          adenda_rubrica_id: null,
          rubrica_nome: l.avulsa_nome.trim(),
          data,
          fornecedor: fornecedor || null,
          descricao,
          valor: valorFinal,
          registado_por: user.id,
        };
      }
      const rub = rubricas.find((r) => r.id === l.rubrica_id);
      const isAdenda = rub?.origem.startsWith("Adenda");
      return {
        obra_id: obraId,
        rubrica_id: isAdenda ? null : l.rubrica_id,
        adenda_rubrica_id: isAdenda ? l.rubrica_id : null,
        rubrica_nome: null,
        data,
        fornecedor: fornecedor || null,
        descricao,
        valor: valorFinal,
        registado_por: user.id,
      };
    });
    const { error } = await supabase.from("lancamentos").insert(rows);
    if (error) toast.error(error.message);
    else {
      const temNegativo = valid.some((l) => l.negativo);
      toast.success(temNegativo ? "Nota de crédito registada" : "Despesa registada");
      onSaved();
    }
  }

  const grupos = rubricas.reduce<Record<string, Rubrica[]>>((acc, r) => {
    (acc[r.origem] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex sm:justify-end" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-lg h-full flex flex-col sm:border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ fontSize: "16px" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Registar despesa / nota crédito</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="Fornecedor">
              <input
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
          </div>
          <Field label="Descrição / Nº fatura">
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </Field>

          <div className="space-y-2">
            <div className="text-sm font-medium">Linhas</div>
            {linhas.map((l, i) => (
              <div key={i} className="space-y-1">
                <div className="flex gap-2 items-center">
                  {customForLine === i ? (
                    <>
                      <input
                        autoFocus
                        list={`padroes-${i}`}
                        value={customDraft}
                        onChange={(e) => setCustomDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            criarPersonalizada(i, customDraft);
                          }
                          if (e.key === "Escape") {
                            setCustomForLine(null);
                            setCustomDraft("");
                          }
                        }}
                        placeholder="Nome da nova rubrica..."
                        className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <datalist id={`padroes-${i}`}>
                        {padroes.map((p) => (
                          <option key={p.id} value={p.nome} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={() => criarPersonalizada(i, customDraft)}
                        className="text-success p-1"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomForLine(null);
                          setCustomDraft("");
                        }}
                        className="text-muted-foreground hover:text-danger p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : l.tipo === "avulsa" ? (
                    <>
                      <input
                        autoFocus
                        value={l.avulsa_nome}
                        onChange={(e) => setLinha(i, { avulsa_nome: e.target.value })}
                        placeholder="Ex: Taxa municipal, Multa..."
                        className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLinha(i, { tipo: "rubrica", avulsa_nome: "", rubrica_id: rubricas[0]?.id ?? "" })
                        }
                        className="text-xs text-muted-foreground hover:text-foreground px-1"
                        title="Voltar à lista"
                      >
                        ↺
                      </button>
                    </>
                  ) : (
                    <select
                      value={l.rubrica_id}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === CUSTOM_TOKEN) {
                          setCustomDraft("");
                          setCustomForLine(i);
                          return;
                        }
                        if (v === AVULSA_TOKEN) {
                          setLinha(i, { tipo: "avulsa", avulsa_nome: "", rubrica_id: "" });
                          return;
                        }
                        setLinha(i, { rubrica_id: v });
                      }}
                      className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {Object.entries(grupos).map(([origem, rubs]) => (
                        <optgroup key={origem} label={origem}>
                          {renderRubricaOptions(rubs)}
                        </optgroup>
                      ))}
                      <option disabled>──────────</option>
                      <option value={CUSTOM_TOKEN}>Nova rubrica personalizada...</option>
                      <option disabled>── Despesa avulsa ──</option>
                      <option value={AVULSA_TOKEN}>+ Registar despesa avulsa...</option>
                    </select>
                  )}

                  <input
                    ref={(el) => {
                      valorRefs.current[i] = el;
                    }}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={l.valor}
                    onChange={(e) => setLinha(i, { valor: e.target.value })}
                    onKeyDown={(e) => onValorKey(e, i)}
                    className={`w-28 border rounded-md px-3 py-2 text-base bg-background focus:outline-none focus:ring-2 focus:ring-primary text-right ${
                      l.negativo ? "border-danger text-danger" : "border-border"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setLinha(i, { negativo: !l.negativo })}
                    title={
                      l.negativo ? "Nota de crédito — clique para reverter" : "Registar como nota de crédito (negativo)"
                    }
                    className={`p-1.5 rounded-md border text-sm shrink-0 ${
                      l.negativo
                        ? "border-danger bg-danger/10 text-danger"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeLinha(i)} className="text-muted-foreground hover:text-danger shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {l.negativo && (
                  <p className="text-xs text-danger pl-1">Nota de crédito — será registada como valor negativo</p>
                )}
              </div>
            ))}
            <button onClick={addLinha} className="text-sm text-primary inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Adicionar linha
            </button>
          </div>

          <div
            className={`flex justify-between items-center border-t border-border pt-3 ${total < 0 ? "text-danger" : ""}`}
          >
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{eur(total)}</span>
          </div>
        </div>

        <div
          className="flex justify-end gap-2 p-4 border-t border-border bg-card sticky bottom-0"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <button onClick={onClose} className="px-4 py-3 text-sm rounded-md border border-input flex-1 sm:flex-none">
            Cancelar
          </button>
          <button
            onClick={save}
            className="px-4 py-3 text-sm rounded-md bg-primary text-primary-foreground font-medium flex-1 sm:flex-none"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
