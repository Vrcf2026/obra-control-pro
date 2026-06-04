import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { eur } from "@/lib/format";
import { Plus, X, Minus, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Rubrica {
  id: string;
  nome: string;
  origem: string;
  parent_id?: string | null;
}
interface SubOpcao {
  id: string | null;
  nome: string;
}
interface Linha {
  rubrica_id: string;
  sub_id: string;
  sub_nome: string;
  modo: "sem" | "existente" | "nova";
  valor: string;
  negativo: boolean;
}

const SEM_SUB = "__sem__";
const NOVA_SUB = "__nova__";

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
  const rubricasPai = rubricasInit.filter((r) => !r.parent_id);

  const [subsPorPai, setSubsPorPai] = useState<Record<string, SubOpcao[]>>({});
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedor, setFornecedor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([
    {
      rubrica_id: rubricasPai[0]?.id ?? "",
      sub_id: "",
      sub_nome: "",
      modo: "sem",
      valor: "",
      negativo: false,
    },
  ]);
  const valorRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    (async () => {
      const { data: padroes } = (await supabase
        .from("rubricas_padrao")
        .select("id,nome,parent_id")
        .not("parent_id", "is", null)
        .eq("ativo", true)) as any;

      const { data: obraSubs } = (await supabase
        .from("rubricas")
        .select("id,nome,parent_id")
        .eq("obra_id", obraId)
        .not("parent_id", "is", null)) as any;

      const nomePaiMap: Record<string, string> = {};
      rubricasPai.forEach((r) => {
        nomePaiMap[r.nome.trim().toLowerCase()] = r.id;
      });

      const paiPadraoIds = [...new Set((padroes ?? []).map((p: any) => p.parent_id as string))] as string[];
      let nomePaiPadrao: Record<string, string> = {};
      if (paiPadraoIds.length > 0) {
        const { data: paisPadrao } = (await supabase
          .from("rubricas_padrao")
          .select("id,nome")
          .in("id", paiPadraoIds)) as any;
        (paisPadrao ?? []).forEach((p: any) => {
          nomePaiPadrao[p.id] = p.nome;
        });
      }

      const map: Record<string, SubOpcao[]> = {};

      (padroes ?? []).forEach((p: any) => {
        const nomePai = nomePaiPadrao[p.parent_id];
        if (!nomePai) return;
        const obraPaiId = nomePaiMap[nomePai.trim().toLowerCase()];
        if (!obraPaiId) return;
        if (!map[obraPaiId]) map[obraPaiId] = [];
        if (!map[obraPaiId].find((x) => x.nome.toLowerCase() === p.nome.toLowerCase())) {
          map[obraPaiId].push({ id: null, nome: p.nome });
        }
      });

      (obraSubs ?? []).forEach((s: any) => {
        if (!map[s.parent_id]) map[s.parent_id] = [];
        const existing = map[s.parent_id].find((x) => x.nome.toLowerCase() === s.nome.toLowerCase());
        if (existing) {
          existing.id = s.id;
        } else {
          map[s.parent_id].push({ id: s.id, nome: s.nome });
        }
      });

      setSubsPorPai(map);
    })();
  }, [obraId]);

  function setLinha(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLinha() {
    setLinhas((ls) => [
      ...ls,
      {
        rubrica_id: rubricasPai[0]?.id ?? "",
        sub_id: "",
        sub_nome: "",
        modo: "sem",
        valor: "",
        negativo: false,
      },
    ]);
    setTimeout(() => valorRefs.current[linhas.length]?.focus(), 50);
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

  async function criarSubrubrica(parentId: string, nome: string): Promise<string | null> {
    const { data: existe } = await (supabase
      .from("rubricas")
      .select("id")
      .eq("obra_id", obraId) as any)
      .eq("parent_id", parentId)
      .ilike("nome", nome)
      .maybeSingle();
    if (existe) return existe.id;

    const { data, error } = await supabase
      .from("rubricas")
      .insert({ obra_id: obraId, nome, orcamento_interno: 0, parent_id: parentId } as any)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      toast.error("Erro ao criar subrubrica: " + (error?.message ?? ""));
      return null;
    }

    setSubsPorPai((prev) => ({
      ...prev,
      [parentId]: [...(prev[parentId] ?? []), { id: data.id, nome }],
    }));

    return data.id;
  }

  async function getRubricaIdParaLinha(linha: Linha): Promise<string | null> {
    if (linha.modo === "sem") return linha.rubrica_id;

    if (linha.modo === "existente") {
      const subs = subsPorPai[linha.rubrica_id] ?? [];
      const sub = subs.find((s) => s.id === linha.sub_id || s.nome === linha.sub_id);
      if (sub?.id) return sub.id;
      const nome = sub?.nome ?? linha.sub_id;
      return await criarSubrubrica(linha.rubrica_id, nome);
    }

    if (linha.modo === "nova") {
      const nome = linha.sub_nome.trim();
      if (!nome) return linha.rubrica_id;
      return await criarSubrubrica(linha.rubrica_id, nome);
    }

    return linha.rubrica_id;
  }

  async function save() {
    if (!user) return;
    const valid = linhas.filter((l) => Number(l.valor) > 0 && l.rubrica_id);
    if (valid.length === 0) {
      toast.error("Adicione pelo menos uma linha com valor");
      return;
    }

    const rows: any[] = [];
    for (const l of valid) {
      const rubricaId = await getRubricaIdParaLinha(l);
      if (!rubricaId) return;
      rows.push({
        obra_id: obraId,
        rubrica_id: rubricaId,
        data,
        fornecedor: fornecedor || null,
        descricao,
        valor: l.negativo ? -Number(l.valor) : Number(l.valor),
        registado_por: user.id,
      });
    }

    const { error } = await supabase.from("lancamentos").insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(valid.some((l) => l.negativo) ? "Nota de crédito registada" : "Despesa registada");
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex sm:justify-end" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-lg h-full flex flex-col sm:border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Registar despesa / nota crédito</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="inp" />
            </Field>
            <Field label="Fornecedor">
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="inp" />
            </Field>
          </div>
          <Field label="Descrição / Nº fatura">
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="inp" />
          </Field>

          <div className="space-y-3">
            <p className="text-sm font-medium">Linhas</p>
            {linhas.map((l, i) => {
              const subs = subsPorPai[l.rubrica_id] ?? [];
              const nomePai = rubricasPai.find((r) => r.id === l.rubrica_id)?.nome ?? "";
              return (
                <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
                  <div className="flex gap-2 items-center">
                    <select
                      value={l.rubrica_id}
                      onChange={(e) =>
                        setLinha(i, { rubrica_id: e.target.value, sub_id: "", sub_nome: "", modo: "sem" })
                      }
                      className="flex-1 inp"
                    >
                      {rubricasPai.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nome}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setLinha(i, { negativo: !l.negativo })}
                      title={l.negativo ? "Cancelar nota de crédito" : "Marcar como nota de crédito"}
                      className={`p-1.5 rounded-md border shrink-0 ${
                        l.negativo
                          ? "border-red-500 bg-red-50 text-red-600 dark:bg-red-950"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeLinha(i)}
                      className="text-muted-foreground hover:text-red-500 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pl-1">
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <select
                      value={l.modo === "existente" ? l.sub_id : l.modo === "nova" ? NOVA_SUB : SEM_SUB}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === SEM_SUB) setLinha(i, { modo: "sem", sub_id: "", sub_nome: "" });
                        else if (v === NOVA_SUB) setLinha(i, { modo: "nova", sub_id: "", sub_nome: "" });
                        else setLinha(i, { modo: "existente", sub_id: v, sub_nome: "" });
                      }}
                      className="flex-1 inp text-sm"
                    >
                      <option value={SEM_SUB}>— Sem subcategoria —</option>
                      {subs.map((s, si) => (
                        <option key={si} value={s.id ?? s.nome}>
                          {s.nome}
                        </option>
                      ))}
                      <option value={NOVA_SUB}>+ Nova subcategoria...</option>
                    </select>
                  </div>

                  {l.modo === "nova" && (
                    <div className="pl-5">
                      <input
                        autoFocus
                        value={l.sub_nome}
                        onChange={(e) => setLinha(i, { sub_nome: e.target.value })}
                        placeholder="Nome da nova subcategoria..."
                        className="inp text-sm"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground pl-1 flex-1">
                      {l.modo === "sem" ? (
                        <span className="text-muted-foreground/60">
                          Desconta directamente em <strong>{nomePai}</strong>
                        </span>
                      ) : l.modo === "existente" ? (
                        <>
                          Subcategoria de <strong>{nomePai}</strong>
                        </>
                      ) : l.sub_nome.trim() ? (
                        <>
                          Nova subcategoria de <strong>{nomePai}</strong>
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">Escreve o nome acima</span>
                      )}
                    </span>
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
                      className={`w-32 inp text-right ${l.negativo ? "text-red-600 border-red-400" : ""}`}
                    />
                  </div>

                  {l.negativo && (
                    <p className="text-xs text-red-500 pl-1">Nota de crédito — será registada como valor negativo</p>
                  )}
                </div>
              );
            })}

            <button onClick={addLinha} className="text-sm text-primary inline-flex items-center gap-1">
              <Plus className="w-4 h-4" /> Adicionar linha
            </button>
          </div>

          <div
            className={`flex justify-between items-center border-t border-border pt-3 ${total < 0 ? "text-red-500" : ""}`}
          >
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">{eur(total)}</span>
          </div>
        </div>

        <div
          className="flex gap-2 p-4 border-t border-border bg-card sticky bottom-0"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <button onClick={onClose} className="flex-1 px-4 py-3 text-sm rounded-md border border-input">
            Cancelar
          </button>
          <button
            onClick={save}
            className="flex-1 px-4 py-3 text-sm rounded-md bg-primary text-primary-foreground font-medium"
          >
            Guardar
          </button>
        </div>
      </div>
      <style>{`.inp{width:100%;border:1px solid var(--border);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px;outline:none}`}</style>
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
