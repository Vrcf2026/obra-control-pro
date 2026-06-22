import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { eur } from "@/lib/format";
import { Plus, X, Minus, Zap, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface Rubrica { id: string; nome: string; origem: string; parent_id?: string | null }
interface SubOpcao { id: string | null; nome: string }
interface Unidade { id: string; nome: string; sigla: string }
interface Fornecedor { id: string; nome: string; nif: string | null }

interface LinhaRapida {
  rubrica_id: string;
  sub_id: string;
  sub_nome_nova: string;
  modo: "sem" | "existente" | "nova";
  valor: string;
  negativo: boolean;
}

const SEM_SUB = "__sem__";
const NOVA_SUB = "__nova__";

export function DespesaPanel({ obraId, rubricas: rubricasInit, onClose, onSaved }: {
  obraId: string; rubricas: Rubrica[]; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const [modo, setModo] = useState<"rapido" | "completo">("rapido");

  // Rubricas pai (sem parent_id)
  const rubricasPai = rubricasInit.filter(r => !r.parent_id);

  // Subs disponíveis por pai
  const [subsPorPai, setSubsPorPai] = useState<Record<string, SubOpcao[]>>({});
  const [showNovoForn, setShowNovoForn] = useState(false);
  const [novoFornNome, setNovoFornNome] = useState("");
  const [novoFornNif, setNovoFornNif] = useState("");
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [fornecedor, setFornecedor] = useState("");
  const [descricao, setDescricao] = useState("");

  // --- REGISTO RÁPIDO ---
  const [linhas, setLinhas] = useState<LinhaRapida[]>([{
    rubrica_id: rubricasPai[0]?.id ?? "", sub_id: "", sub_nome_nova: "", modo: "sem", valor: "", negativo: false,
  }]);
  const valorRefs = useRef<(HTMLInputElement | null)[]>([]);
  const subNovaRefs = useRef<(HTMLInputElement | null)[]>([]);

  // --- REGISTO COMPLETO ---
  const [fornecedorId, setFornecedorId] = useState("");
  const [rubricaId, setRubricaId] = useState(rubricasPai[0]?.id ?? "");
  const [subId, setSubId] = useState("");
  const [subNomeNova, setSubNomeNova] = useState("");
  const [subModo, setSubModo] = useState<"sem" | "existente" | "nova">("sem");
  const [quantidade, setQuantidade] = useState("");
  const [precoUnit, setPrecoUnit] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [numDoc, setNumDoc] = useState("");
  const [valorDirecto, setValorDirecto] = useState(false);
  const [valorDir, setValorDir] = useState("");
  const [negativo, setNegativo] = useState(false);

  const valorCalculado = !valorDirecto && quantidade && precoUnit
    ? (Number(quantidade) * Number(precoUnit)).toFixed(2)
    : valorDir;

  useEffect(() => {
    (async () => {
      // Load subs
      const { data: padroes } = await supabase.from("rubricas_padrao").select("id,nome,parent_id")
        .not("parent_id", "is", null).eq("ativo", true) as any;
      const { data: obraSubs } = await supabase.from("rubricas").select("id,nome,parent_id")
        .eq("obra_id", obraId).not("parent_id", "is", null) as any;
      const nomePaiMap: Record<string, string> = {};
      rubricasPai.forEach(r => { nomePaiMap[r.nome.trim().toLowerCase()] = r.id; });
      const paiPadraoIds = [...new Set((padroes ?? []).map((p: any) => p.parent_id))] as string[];
      let nomePaiPadrao: Record<string, string> = {};
      if (paiPadraoIds.length > 0) {
        const { data: paisPadrao } = await supabase.from("rubricas_padrao").select("id,nome").in("id", paiPadraoIds) as any;
        (paisPadrao ?? []).forEach((p: any) => { nomePaiPadrao[p.id] = p.nome; });
      }
      const map: Record<string, SubOpcao[]> = {};
      (padroes ?? []).forEach((p: any) => {
        const nomePai = nomePaiPadrao[p.parent_id]; if (!nomePai) return;
        const obraPaiId = nomePaiMap[nomePai.trim().toLowerCase()]; if (!obraPaiId) return;
        if (!map[obraPaiId]) map[obraPaiId] = [];
        if (!map[obraPaiId].find(x => x.nome.toLowerCase() === p.nome.toLowerCase()))
          map[obraPaiId].push({ id: null, nome: p.nome });
      });
      (obraSubs ?? []).forEach((s: any) => {
        if (!map[s.parent_id]) map[s.parent_id] = [];
        const existing = map[s.parent_id].find(x => x.nome.toLowerCase() === s.nome.toLowerCase());
        if (existing) existing.id = s.id; else map[s.parent_id].push({ id: s.id, nome: s.nome });
      });
      setSubsPorPai(map);

      // Load unidades
      const { data: uns } = await supabase.from("unidades").select("id,nome,sigla").order("ordem");
      setUnidades((uns ?? []) as Unidade[]);

      // Load fornecedores
      const { data: forns } = await supabase.from("fornecedores").select("id,nome,nif").eq("ativo", true).order("nome");
      setFornecedores((forns ?? []) as Fornecedor[]);
    })();
  }, [obraId]);

  // Check if rubrica has subs (must use sub)
  function rubricaTemSubs(rId: string) {
    return (subsPorPai[rId] ?? []).length > 0;
  }

  function setLinha(i: number, patch: Partial<LinhaRapida>) {
    setLinhas(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLinha() {
    setLinhas(ls => [...ls, { rubrica_id: rubricasPai[0]?.id ?? "", sub_id: "", sub_nome_nova: "", modo: "sem", valor: "", negativo: false }]);
    setTimeout(() => valorRefs.current[linhas.length]?.focus(), 50);
  }
  function removeLinha(i: number) { if (linhas.length > 1) setLinhas(ls => ls.filter((_, idx) => idx !== i)); }

  const totalRapido = linhas.reduce((s, l) => {
    const v = Number(l.valor) || 0; return s + (l.negativo ? -v : v);
  }, 0);

  async function criarFornecedor() {
    if (!novoFornNome.trim()) { toast.error("Nome obrigatório"); return; }
    const { data, error } = await supabase.from("fornecedores")
      .insert({ nome: novoFornNome.trim(), nif: novoFornNif || null, ativo: true })
      .select("id,nome,nif").maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    setFornecedores(fs => [...fs, data as Fornecedor].sort((a, b) => a.nome.localeCompare(b.nome)));
    setFornecedorId((data as any).id);
    setShowNovoForn(false); setNovoFornNome(""); setNovoFornNif("");
    toast.success("Fornecedor criado");
  }

  async function criarSubrubrica(parentId: string, nome: string): Promise<string | null> {
    const { data: existe } = await supabase.from("rubricas").select("id")
      .eq("obra_id", obraId).eq("parent_id", parentId).ilike("nome", nome).maybeSingle();
    if (existe) return existe.id;
    const { data, error } = await supabase.from("rubricas")
      .insert({ obra_id: obraId, nome, orcamento_interno: 0, parent_id: parentId } as any)
      .select("id").maybeSingle();
    if (error || !data) { toast.error("Erro ao criar subcategoria"); return null; }
    setSubsPorPai(prev => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), { id: data.id, nome }] }));
    return data.id;
  }

  async function getRubricaIdLinha(l: LinhaRapida): Promise<string | null> {
    // If rubrica has subs, must use sub
    if (rubricaTemSubs(l.rubrica_id) && l.modo === "sem") {
      toast.error(`A rubrica tem subcategorias — escolhe uma subcategoria`); return null;
    }
    if (l.modo === "sem") return l.rubrica_id;
    if (l.modo === "existente") {
      const subs = subsPorPai[l.rubrica_id] ?? [];
      const sub = subs.find(s => s.id === l.sub_id || s.nome === l.sub_id);
      if (sub?.id) return sub.id;
      return await criarSubrubrica(l.rubrica_id, sub?.nome ?? l.sub_id);
    }
    if (l.modo === "nova") {
      const nome = l.sub_nome_nova.trim();
      if (!nome) return l.rubrica_id;
      return await criarSubrubrica(l.rubrica_id, nome);
    }
    return l.rubrica_id;
  }

  async function saveRapido() {
    if (!user) return;
    const valid = linhas.filter(l => Number(l.valor) > 0 && l.rubrica_id);
    if (valid.length === 0) { toast.error("Adicione pelo menos uma linha com valor"); return; }
    const rows: any[] = [];
    for (const l of valid) {
      const rid = await getRubricaIdLinha(l);
      if (!rid) return;
      rows.push({
        obra_id: obraId, rubrica_id: rid, data,
        fornecedor: fornecedor || null,
        fornecedor_id: fornecedorId || null,
        descricao,
        valor: l.negativo ? -(Number(l.valor)) : Number(l.valor),
        registado_por: user.id,
      } as any);
    }
    const { error } = await supabase.from("lancamentos").insert(rows);
    if (error) toast.error(error.message);
    else { toast.success(linhas.some(l => l.negativo) ? "Nota de crédito registada" : "Registo rápido guardado"); onSaved(); }
  }

  async function saveCompleto() {
    if (!user) return;
    if (!fornecedorId) { toast.error("Fornecedor obrigatório"); return; }

    // Determine rubrica
    let rid: string | null = rubricaId;
    if (rubricaTemSubs(rubricaId) && subModo === "sem") {
      toast.error("Esta rubrica tem subcategorias — escolhe uma"); return;
    }
    if (subModo === "existente") {
      const subs = subsPorPai[rubricaId] ?? [];
      const sub = subs.find(s => s.id === subId || s.nome === subId);
      if (sub?.id) rid = sub.id;
      else rid = await criarSubrubrica(rubricaId, sub?.nome ?? subId);
    } else if (subModo === "nova") {
      const nome = subNomeNova.trim();
      if (nome) rid = await criarSubrubrica(rubricaId, nome);
    }
    if (!rid) return;

    const valorFinal = valorDirecto ? Number(valorDir) : Number(quantidade) * Number(precoUnit);
    if (!valorFinal || valorFinal <= 0) { toast.error("Valor inválido"); return; }

    const { error } = await supabase.from("lancamentos").insert({
      obra_id: obraId, rubrica_id: rid, data, descricao,
      fornecedor: fornecedores.find(f => f.id === fornecedorId)?.nome ?? null,
      fornecedor_id: fornecedorId,
      quantidade: valorDirecto ? null : Number(quantidade) || null,
      preco_unitario: valorDirecto ? null : Number(precoUnit) || null,
      unidade_id: unidadeId || null,
      num_documento: numDoc || null,
      valor: negativo ? -valorFinal : valorFinal,
      registado_por: user.id,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success(negativo ? "Nota de crédito registada" : "Despesa registada"); onSaved(); }
  }

  const subsRubricaCompleto = subsPorPai[rubricaId] ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex sm:justify-end" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg h-full flex flex-col sm:border-l border-border"
        onClick={e => e.stopPropagation()}>

        {/* Mode selector */}
        <div className="flex border-b border-border">
          <button onClick={() => setModo("rapido")}
            className={`flex-1 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors ${modo === "rapido" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Zap className="w-4 h-4" /> Registo rápido
          </button>
          <button onClick={() => setModo("completo")}
            className={`flex-1 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors ${modo === "completo" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <ClipboardList className="w-4 h-4" /> Registar despesa
          </button>
          <button onClick={onClose} className="px-4 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="inp" />
            </Field>
            {modo === "rapido" ? (
              <Field label="Fornecedor (opcional)">
                <select value={fornecedorId} onChange={e => {
                  if (e.target.value === "__novo__") { setShowNovoForn(true); return; }
                  setFornecedorId(e.target.value);
                  setFornecedor(fornecedores.find(f => f.id === e.target.value)?.nome ?? "");
                }} className="inp">
                  <option value="">— nenhum —</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}{f.nif ? ` (${f.nif})` : ""}</option>)}
                  <option value="__novo__">+ Novo fornecedor</option>
                </select>
                {showNovoForn && (
                  <div className="mt-2 p-3 border border-border rounded-md bg-muted/30 space-y-2">
                    <input autoFocus value={novoFornNome} onChange={e => setNovoFornNome(e.target.value)} placeholder="Nome *" className="inp" />
                    <input value={novoFornNif} onChange={e => setNovoFornNif(e.target.value)} placeholder="NIF" className="inp" />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowNovoForn(false)} className="px-3 py-1.5 text-xs rounded-md border border-input">Cancelar</button>
                      <button type="button" onClick={criarFornecedor} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">Criar</button>
                    </div>
                  </div>
                )}
              </Field>
            ) : (
              <Field label="Fornecedor *">
                <select value={fornecedorId} onChange={e => {
                  if (e.target.value === "__novo__") { setShowNovoForn(true); return; }
                  setFornecedorId(e.target.value);
                }} className="inp">
                  <option value="">— escolher —</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}{f.nif ? ` (${f.nif})` : ""}</option>)}
                  <option value="__novo__">+ Novo fornecedor</option>
                </select>
                {showNovoForn && (
                  <div className="mt-2 p-3 border border-border rounded-md bg-muted/30 space-y-2">
                    <input autoFocus value={novoFornNome} onChange={e => setNovoFornNome(e.target.value)} placeholder="Nome *" className="inp" />
                    <input value={novoFornNif} onChange={e => setNovoFornNif(e.target.value)} placeholder="NIF" className="inp" />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setShowNovoForn(false)} className="px-3 py-1.5 text-xs rounded-md border border-input">Cancelar</button>
                      <button type="button" onClick={criarFornecedor} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">Criar</button>
                    </div>
                  </div>
                )}
              </Field>
            )}
          </div>
          <Field label="Descrição / Nº fatura">
            <input value={descricao} onChange={e => setDescricao(e.target.value)} className="inp" />
          </Field>

          {/* REGISTO RÁPIDO */}
          {modo === "rapido" && (
            <div className="space-y-1">
              <div className="grid gap-1 text-xs text-muted-foreground px-1 pb-1" style={{ gridTemplateColumns: "1fr 1fr 90px 28px 28px" }}>
                <span>Rubrica</span><span>Subcategoria</span><span className="text-right">Valor (€)</span><span></span><span></span>
              </div>
              {linhas.map((l, i) => {
                const subs = subsPorPai[l.rubrica_id] ?? [];
                const temSubs = subs.length > 0;
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="grid gap-1 items-center" style={{ gridTemplateColumns: "1fr 1fr 90px 28px 28px" }}>
                      <select value={l.rubrica_id}
                        onChange={e => setLinha(i, { rubrica_id: e.target.value, sub_id: "", sub_nome_nova: "", modo: "sem" })}
                        className="inp-sm">
                        {rubricasPai.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                      </select>

                      {l.modo === "nova" ? (
                        <input ref={el => { subNovaRefs.current[i] = el; }} autoFocus value={l.sub_nome_nova}
                          onChange={e => setLinha(i, { sub_nome_nova: e.target.value })}
                          onBlur={() => { if (!l.sub_nome_nova.trim()) setLinha(i, { modo: "sem" }); }}
                          onKeyDown={e => { if (e.key === "Escape") setLinha(i, { modo: "sem", sub_nome_nova: "" }); }}
                          placeholder="Nome..." className="inp-sm" />
                      ) : (
                        <select value={l.modo === "existente" ? l.sub_id : SEM_SUB}
                          onChange={e => {
                            const v = e.target.value;
                            if (v === SEM_SUB) setLinha(i, { modo: "sem", sub_id: "", sub_nome_nova: "" });
                            else if (v === NOVA_SUB) { setLinha(i, { modo: "nova", sub_id: "", sub_nome_nova: "" }); setTimeout(() => subNovaRefs.current[i]?.focus(), 50); }
                            else setLinha(i, { modo: "existente", sub_id: v, sub_nome_nova: "" });
                          }}
                          className={`inp-sm ${temSubs && l.modo === "sem" ? "border-amber-400" : ""}`}>
                          <option value={SEM_SUB}>{temSubs ? "⚠ Escolhe sub..." : "— Nenhuma —"}</option>
                          {subs.map((s, si) => <option key={si} value={s.id ?? s.nome}>{s.nome}</option>)}
                          <option value={NOVA_SUB}>+ Nova...</option>
                        </select>
                      )}

                      <input ref={el => { valorRefs.current[i] = el; }} type="number" step="0.01" inputMode="decimal"
                        placeholder="0,00" value={l.valor} onChange={e => setLinha(i, { valor: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (i === linhas.length - 1) addLinha(); else valorRefs.current[i + 1]?.focus(); } }}
                        className={`inp-sm text-right ${l.negativo ? "text-red-600 border-red-400" : ""}`} />

                      <button type="button" onClick={() => setLinha(i, { negativo: !l.negativo })}
                        className={`h-8 w-7 rounded border flex items-center justify-center shrink-0 ${l.negativo ? "border-red-400 bg-red-50 text-red-600" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeLinha(i)} disabled={linhas.length === 1}
                        className="h-8 w-7 flex items-center justify-center text-muted-foreground hover:text-red-500 disabled:opacity-30">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {(l.modo !== "sem" || l.negativo) && (
                      <div className="flex gap-3 px-1 text-xs text-muted-foreground">
                        {l.modo !== "sem" && <span>↳ desconta em <strong>{rubricasPai.find(r => r.id === l.rubrica_id)?.nome}</strong></span>}
                        {l.negativo && <span className="text-red-500">nota de crédito</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={addLinha} className="text-sm text-primary inline-flex items-center gap-1 pt-1">
                <Plus className="w-4 h-4" /> Adicionar linha
              </button>
              <div className={`flex justify-between items-center border-t border-border pt-3 font-medium ${totalRapido < 0 ? "text-red-500" : ""}`}>
                <span className="text-sm">Total</span>
                <span className="tabular-nums">{eur(totalRapido)}</span>
              </div>
            </div>
          )}

          {/* REGISTO COMPLETO */}
          {modo === "completo" && (
            <div className="space-y-3">
              <Field label="Rubrica *">
                <select value={rubricaId} onChange={e => { setRubricaId(e.target.value); setSubId(""); setSubNomeNova(""); setSubModo("sem"); }} className="inp">
                  {rubricasPai.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </Field>

              <Field label={`Subcategoria${rubricaTemSubs(rubricaId) ? " *" : " (opcional)"}`}>
                {subModo === "nova" ? (
                  <div className="flex gap-2">
                    <input autoFocus value={subNomeNova} onChange={e => setSubNomeNova(e.target.value)} placeholder="Nome da subcategoria..." className="inp flex-1" />
                    <button onClick={() => { setSubModo("sem"); setSubNomeNova(""); }} className="text-muted-foreground hover:text-danger p-1"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <select value={subModo === "existente" ? subId : SEM_SUB}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === SEM_SUB) { setSubModo("sem"); setSubId(""); }
                      else if (v === NOVA_SUB) { setSubModo("nova"); setSubId(""); }
                      else { setSubModo("existente"); setSubId(v); }
                    }}
                    className={`inp ${rubricaTemSubs(rubricaId) && subModo === "sem" ? "border-amber-400" : ""}`}>
                    <option value={SEM_SUB}>{rubricaTemSubs(rubricaId) ? "⚠ Obrigatório — escolhe subcategoria" : "— Sem subcategoria —"}</option>
                    {subsRubricaCompleto.map((s, si) => <option key={si} value={s.id ?? s.nome}>{s.nome}</option>)}
                    <option value={NOVA_SUB}>+ Nova subcategoria...</option>
                  </select>
                )}
              </Field>

              <Field label="Nº documento / fatura">
                <input value={numDoc} onChange={e => setNumDoc(e.target.value)} placeholder="Ex: FT2024/0001" className="inp" />
              </Field>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="valdir" checked={valorDirecto} onChange={e => setValorDirecto(e.target.checked)} className="w-4 h-4" />
                <label htmlFor="valdir" className="text-sm text-muted-foreground cursor-pointer">Introduzir valor directo (sem quantidade × preço)</label>
              </div>

              {valorDirecto ? (
                <Field label="Valor (€) *">
                  <input type="number" step="0.01" value={valorDir} onChange={e => setValorDir(e.target.value)} placeholder="0,00" className="inp" />
                </Field>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Quantidade *">
                    <input type="number" step="0.001" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="0" className="inp" />
                  </Field>
                  <Field label="Unidade">
                    <select value={unidadeId} onChange={e => setUnidadeId(e.target.value)} className="inp">
                      <option value="">—</option>
                      {unidades.map(u => <option key={u.id} value={u.id}>{u.sigla} — {u.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Preço unit. (€) *">
                    <input type="number" step="0.0001" value={precoUnit} onChange={e => setPrecoUnit(e.target.value)} placeholder="0,00" className="inp" />
                  </Field>
                </div>
              )}

              {!valorDirecto && quantidade && precoUnit && (
                <div className="flex justify-between text-sm bg-muted/30 rounded-md px-3 py-2">
                  <span className="text-muted-foreground">Total calculado</span>
                  <span className="font-medium tabular-nums">{eur(Number(quantidade) * Number(precoUnit))}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setNegativo(!negativo)}
                  className={`px-3 py-1.5 text-sm rounded border inline-flex items-center gap-1.5 ${negativo ? "border-red-400 bg-red-50 text-red-600" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  <Minus className="w-3.5 h-3.5" /> Nota de crédito
                </button>
                {negativo && <span className="text-xs text-red-500">Será registada como valor negativo</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border bg-card sticky bottom-0"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <button onClick={onClose} className="flex-1 px-4 py-3 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={modo === "rapido" ? saveRapido : saveCompleto}
            className="flex-1 px-4 py-3 text-sm rounded-md bg-primary text-primary-foreground font-medium">
            Guardar
          </button>
        </div>
      </div>
      <style>{`
        .inp{width:100%;border:1px solid var(--border);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px;outline:none}
        .inp-sm{width:100%;border:1px solid var(--border);background:var(--background);border-radius:6px;padding:5px 8px;font-size:13px;outline:none;height:32px}
        .inp:focus,.inp-sm:focus{border-color:var(--primary)}
      `}</style>
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
