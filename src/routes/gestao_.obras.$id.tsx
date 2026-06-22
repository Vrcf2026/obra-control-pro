import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { eur } from "@/lib/format";
import { ArrowLeft, Plus, X, Upload, ChevronRight } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard } from "@/components/SkeletonTable";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/gestao_/obras/$id")({
  component: () => (
    <Protected allow={["admin"]}>
      <Editor />
    </Protected>
  ),
});

interface RubricaRow {
  id?: string;
  nome: string;
  valor: string;
  parent_id?: string | null;
  isFixed?: boolean;
}
interface Cliente {
  id: string;
  nome: string;
  nif: string | null;
  telefone: string | null;
}

const RUBRICAS_FIXAS = ["Mão de Obra Própria", "Materiais", "Subempreitada"];

function calcFimFromPrazo(ini: string, dias: number): string {
  if (!ini || !dias || dias <= 0) return "";
  const d = new Date(ini);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function calcPrazoFromDates(ini: string, fim: string): number {
  if (!ini || !fim) return 0;
  const a = new Date(ini),
    b = new Date(fim);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function Editor() {
  const { id } = Route.useParams();
  const isNew = id === "novo";
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [cliente, setCliente] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoNif, setNovoNif] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [loc, setLoc] = useState("");
  const [estado, setEstado] = useState("orcamentacao");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  const [orcCliente, setOrcCliente] = useState("0");
  const [rubricas, setRubricas] = useState<RubricaRow[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [fixedIds, setFixedIds] = useState<Record<string, string>>({});
  const [showNovoColab, setShowNovoColab] = useState(false);
  const [novoColabNome, setNovoColabNome] = useState("");
  const [novoColabCargo, setNovoColabCargo] = useState("");
  // subrubrica suggestions from existing obras
  const [subSugestoes, setSubSugestoes] = useState<Record<string, string[]>>({});
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string; cargo: string | null }[]>([]);
  const [respCliente, setRespCliente] = useState("");
  const [respInternoId, setRespInternoId] = useState("");
  const nomeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [expandedRubricas, setExpandedRubricas] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isNew) {
      setRubricas(RUBRICAS_FIXAS.map((n) => ({ nome: n, valor: "", isFixed: true })));
    }
  }, [isNew]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("clientes").select("id,nome,nif,telefone").order("nome");
      setClientes((data ?? []) as Cliente[]);
      const { data: colabs } = await (supabase.from("colaboradores") as any).select("id,nome,cargo").eq("ativo", true).order("nome");
      setColaboradores(colabs ?? []);
      // Load existing subrubrica names for suggestions
      const { data: existingSubs } = await supabase.from("rubricas").select("nome,parent_id").not("parent_id", "is", null) as any;
      const { data: rubPais } = await supabase.from("rubricas").select("id,nome").is("parent_id", null) as any;
      const paiNomeMap = new Map<string, string>((rubPais ?? []).map((r: any) => [r.id as string, r.nome as string]));
      const sugMap: Record<string, Set<string>> = {};
      (existingSubs ?? []).forEach((s: any) => {
        const paiNome = paiNomeMap.get(s.parent_id);
        if (!paiNome) return;
        if (!sugMap[paiNome]) sugMap[paiNome] = new Set();
        sugMap[paiNome].add(s.nome);
      });
      const sugObj: Record<string, string[]> = {};
      Object.entries(sugMap).forEach(([k, v]) => { sugObj[k] = Array.from(v); });
      setSubSugestoes(sugObj);
    })();
  }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const [{ data: o }, { data: r }] = await Promise.all([
        supabase.from("obras").select("*").eq("id", id).maybeSingle(),
        supabase.from("rubricas").select("*").eq("obra_id", id).order("created_at"),
      ]);
      if (o) {
        setNome(o.nome);
        setCliente(o.cliente);
        setLoc(o.localizacao ?? "");
        setClienteId((o as any).cliente_id ?? "");
        setEstado(o.estado);
        setIni(o.data_inicio ?? "");
        setFim(o.data_fim_previsto ?? "");
        setOrcCliente(String((o as any).orcamento_cliente ?? 0));
        setRespCliente((o as any).responsavel_cliente ?? "");
        setRespInternoId((o as any).responsavel_interno_id ?? "");
        if ((o as any).prazo_dias) setPrazoDias(String((o as any).prazo_dias));
        else if (o.data_inicio && o.data_fim_previsto) {
          setPrazoDias(String(calcPrazoFromDates(o.data_inicio, o.data_fim_previsto)));
        }
      }
      const rs = (r ?? []).map((x: any) => ({
        id: x.id,
        nome: x.nome,
        valor: String(x.orcamento_interno),
        parent_id: x.parent_id ?? null,
        isFixed: RUBRICAS_FIXAS.includes(x.nome),
      }));
      const fids: Record<string, string> = {};
      rs.filter((x) => x.isFixed && x.id).forEach((x) => {
        fids[x.nome] = x.id!;
      });
      setFixedIds(fids);
      const existing = new Set(rs.map((x) => x.nome));
      const filled = [...rs];
      RUBRICAS_FIXAS.forEach((n) => {
        if (!existing.has(n)) filled.unshift({ nome: n, valor: "", isFixed: true, id: undefined, parent_id: null });
      });
      filled.sort((a, b) => {
        const ai = RUBRICAS_FIXAS.indexOf(a.nome);
        const bi = RUBRICAS_FIXAS.indexOf(b.nome);
        if (a.isFixed && !b.isFixed) return -1;
        if (!a.isFixed && b.isFixed) return 1;
        if (a.isFixed && b.isFixed) return ai - bi;
        return 0;
      });
      setRubricas(filled);
      setOriginalIds(rs.filter((x) => x.id).map((x) => x.id!));
      setLoading(false);
    })();
  }, [id, isNew]);

  function handlePrazo(val: string) {
    setPrazoDias(val);
    const n = parseInt(val);
    if (ini && n > 0) setFim(calcFimFromPrazo(ini, n));
  }
  function handleIni(val: string) {
    setIni(val);
    const n = parseInt(prazoDias);
    if (n > 0) {
      setFim(calcFimFromPrazo(val, n));
    } else if (fim) {
      setPrazoDias(String(calcPrazoFromDates(val, fim)));
    }
  }
  function handleFim(val: string) {
    setFim(val);
    if (ini) setPrazoDias(String(calcPrazoFromDates(ini, val)));
  }

  async function criarColaborador() {
    if (!novoColabNome.trim()) { toast.error("Nome obrigatório"); return; }
    const { data, error } = await (supabase.from("colaboradores") as any)
      .insert({ nome: novoColabNome.trim(), cargo: novoColabCargo || null, ativo: true })
      .select("id,nome,cargo").maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    setColaboradores((cs: any[]) => [...cs, data].sort((a: any, b: any) => a.nome.localeCompare(b.nome)));
    setRespInternoId(data.id);
    setShowNovoColab(false); setNovoColabNome(""); setNovoColabCargo("");
    toast.success("Colaborador criado");
  }

  async function criarCliente() {
    if (!novoNome.trim()) {
      toast.error("Nome do cliente obrigatório");
      return;
    }
    const { data, error } = await supabase
      .from("clientes")
      .insert({ nome: novoNome.trim(), nif: novoNif || null, telefone: novoTel || null })
      .select("id,nome,nif,telefone")
      .maybeSingle();
    if (error || !data) {
      toast.error(error?.message ?? "Erro");
      return;
    }
    setClientes((cs) => [...cs, data as Cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
    setClienteId(data.id);
    setCliente(data.nome);
    setShowNovoCliente(false);
    setNovoNome("");
    setNovoNif("");
    setNovoTel("");
    toast.success("Cliente criado");
  }

  function setRow(i: number, patch: Partial<RubricaRow>) {
    setRubricas((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addSubrubrica(parentNome: string) {
    setRubricas((rs) => {
      const idx =
        rs
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r.nome === parentNome || r.parent_id === parentNome)
          .pop()?.i ?? rs.length - 1;
      return [...rs.slice(0, idx + 1), { nome: "", valor: "", parent_id: parentNome }, ...rs.slice(idx + 1)];
    });
  }

  function addRow() {
    setRubricas((rs) => [...rs, { nome: "", valor: "" }]);
    setTimeout(() => nomeRefs.current[rubricas.length]?.focus(), 0);
  }
  function removeRow(i: number) {
    const r = rubricas[i];
    if (r.isFixed) {
      toast.error("As rubricas base não podem ser removidas");
      return;
    }
    setRubricas((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function importXlsx(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const parsed: RubricaRow[] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const a = row[0];
      const b = row[1];
      const nomeCell = a == null ? "" : String(a).trim();
      const valNum = Number(String(b ?? "").replace(",", "."));
      if (!nomeCell) continue;
      if (parsed.length === 0 && isNaN(valNum)) continue;
      parsed.push({ nome: nomeCell, valor: isNaN(valNum) ? "" : String(valNum) });
    }
    if (parsed.length === 0) {
      toast.error("Nenhuma linha válida no ficheiro");
      return;
    }
    setRubricas((rs) => [...rs.filter((r) => r.isFixed), ...parsed]);
    toast.success(`${parsed.length} rubricas importadas`);
  }

  const totInterno = rubricas.filter((r) => !r.parent_id).reduce((s, r) => s + (Number(r.valor) || 0), 0);

  async function save() {
    if (!nome || !cliente) {
      toast.error("Nome e cliente obrigatórios");
      return;
    }
    const payload: any = {
      nome,
      cliente,
      cliente_id: clienteId || null,
      localizacao: loc || null,
      estado: estado as never,
      data_inicio: ini || null,
      data_fim_previsto: fim || null,
      orcamento_cliente: Number(orcCliente),
      prazo_dias: prazoDias ? parseInt(prazoDias) : null,
      responsavel_cliente: respCliente || null,
      responsavel_interno_id: respInternoId || null,
    };

    let obraId = id;
    if (isNew) {
      const { data, error } = await supabase.from("obras").insert(payload).select("id").maybeSingle();
      if (error || !data) {
        toast.error(error?.message ?? "Erro");
        return;
      }
      obraId = data.id;
    } else {
      const { error } = await supabase.from("obras").update(payload).eq("id", id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    const validRows = rubricas.filter((r) => r.nome.trim());
    const keepIds = validRows.filter((r) => r.id).map((r) => r.id!);
    const toDelete = originalIds.filter((oid) => !keepIds.includes(oid));
    if (toDelete.length) await supabase.from("rubricas").delete().in("id", toDelete);

    const parentIdMap: Record<string, string> = { ...fixedIds };
    for (const r of validRows) {
      if (r.parent_id) continue;
      if (r.id) {
        await supabase
          .from("rubricas")
          .update({ nome: r.nome, orcamento_interno: Number(r.valor) || 0, parent_id: null } as any)
          .eq("id", r.id);
        parentIdMap[r.nome] = r.id;
      } else {
        const { data: nr } = await supabase
          .from("rubricas")
          .insert({ obra_id: obraId, nome: r.nome, orcamento_interno: Number(r.valor) || 0, parent_id: null } as any)
          .select("id")
          .maybeSingle();
        if (nr) parentIdMap[r.nome] = nr.id;
      }
    }
    for (const r of validRows) {
      if (!r.parent_id) continue;
      const parentDbId = parentIdMap[r.parent_id] ?? null;
      if (r.id) {
        await supabase
          .from("rubricas")
          .update({ nome: r.nome, orcamento_interno: Number(r.valor) || 0, parent_id: parentDbId } as any)
          .eq("id", r.id);
      } else {
        await supabase.from("rubricas").insert({
          obra_id: obraId,
          nome: r.nome,
          orcamento_interno: Number(r.valor) || 0,
          parent_id: parentDbId,
        } as any);
      }
    }

    toast.success("Obra guardada");
    navigate({ to: "/gestao" });
  }

  if (loading) return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div>
        <Breadcrumb crumbs={[
          { label: "Gestão", to: "/gestao" },
          { label: isNew ? "Nova obra" : "Editar obra" },
        ]} />
        <h1 className="text-2xl font-semibold mt-2">{isNew ? "Nova obra" : "Editar obra"}</h1>
      </div>

      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-medium">Dados gerais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <F label="Nome">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
          </F>
          <F label="Cliente">
            <select
              value={clienteId}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__novo__") {
                  setShowNovoCliente(true);
                  return;
                }
                setClienteId(v);
                const c = clientes.find((x) => x.id === v);
                if (c) setCliente(c.nome);
              }}
              className="input"
            >
              <option value="">— escolher cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
              <option value="__novo__">+ Novo cliente</option>
            </select>
            {showNovoCliente && (
              <div className="mt-2 p-3 border border-border rounded-md bg-muted/30 space-y-2">
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome *"
                  className="input"
                />
                <input
                  value={novoNif}
                  onChange={(e) => setNovoNif(e.target.value)}
                  placeholder="NIF"
                  className="input"
                />
                <input
                  value={novoTel}
                  onChange={(e) => setNovoTel(e.target.value)}
                  placeholder="Telefone"
                  className="input"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowNovoCliente(false)}
                    className="px-3 py-1.5 text-xs rounded-md border border-input"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={criarCliente}
                    className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground"
                  >
                    Criar
                  </button>
                </div>
              </div>
            )}
          </F>
          <F label="Localização">
            <input value={loc} onChange={(e) => setLoc(e.target.value)} className="input" />
          </F>
          <F label="Estado">
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
              <option value="orcamentacao">Orçamentação</option>
              <option value="adjudicada">Adjudicada</option>
              <option value="em_curso">Em curso</option>
              <option value="concluida">Concluída</option>
              <option value="faturada">Faturada</option>
            </select>
          </F>
          <F label="Data início">
            <input type="date" value={ini} onChange={(e) => handleIni(e.target.value)} className="input" />
          </F>
          <F label="Prazo (dias)">
            <input
              type="number"
              min="0"
              step="1"
              value={prazoDias}
              onChange={(e) => handlePrazo(e.target.value)}
              placeholder="Ex: 90"
              className="input"
            />
          </F>
          <F label="Fim previsto (calculado ou manual)">
            <input type="date" value={fim} onChange={(e) => handleFim(e.target.value)} className="input" />
          </F>
          <F label="Orçamento cliente (€)">
            <input
              type="number"
              step="0.01"
              value={orcCliente}
              onChange={(e) => setOrcCliente(e.target.value)}
              className="input"
            />
          </F>
          <F label="Responsável (cliente)">
            <input value={respCliente} onChange={e => setRespCliente(e.target.value)} placeholder="Nome do responsável do cliente" className="input" />
          </F>
          <F label="Responsável interno">
            <select value={respInternoId} onChange={e => {
              if (e.target.value === "__novo__") { setShowNovoColab(true); return; }
              setRespInternoId(e.target.value);
            }} className="input">
              <option value="">— Nenhum —</option>
              {colaboradores.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` (${c.cargo})` : ""}</option>
              ))}
              <option value="__novo__">+ Novo colaborador</option>
            </select>
            {showNovoColab && (
              <div className="mt-2 p-3 border border-border rounded-md bg-muted/30 space-y-2">
                <input value={novoColabNome} onChange={e => setNovoColabNome(e.target.value)} placeholder="Nome *" className="input" />
                <input value={novoColabCargo} onChange={e => setNovoColabCargo(e.target.value)} placeholder="Cargo" className="input" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNovoColab(false)} className="px-3 py-1.5 text-xs rounded-md border border-input">Cancelar</button>
                  <button onClick={criarColaborador} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">Criar</button>
                </div>
              </div>
            )}
          </F>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-medium">Orçamento interno</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              As 3 rubricas base estão sempre presentes. Pode adicionar subrubricas ou outras rubricas.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importXlsx(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm border border-input px-3 py-1.5 rounded-md inline-flex items-center gap-1"
            >
              <Upload className="w-4 h-4" /> Importar Excel
            </button>
            <button
              onClick={addRow}
              className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Linha
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">Rubrica</th>
                <th className="text-right p-2 w-40">Valor (€)</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rubricas.map((r, i) => {
                const isSub = !!r.parent_id;
                const subsCount = !isSub ? rubricas.filter(x => x.parent_id === r.nome).length : 0;
                const isExpanded = !isSub && expandedRubricas.has(r.nome);
                if (isSub && !expandedRubricas.has(r.parent_id!)) return null;
                return (
                  <tr key={i} className={`border-t border-border ${isSub ? "bg-muted/20" : ""}`}>
                    <td className="p-1.5">
                      <div className={`flex items-center gap-1 ${isSub ? "pl-6" : ""}`}>
                        {isSub && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                        {!isSub && subsCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedRubricas(prev => {
                              const next = new Set(prev);
                              if (next.has(r.nome)) next.delete(r.nome); else next.add(r.nome);
                              return next;
                            })}
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!isSub && subsCount === 0 && <span className="w-3.5 inline-block shrink-0" />}
                        {r.isFixed ? (
                          <span className="px-2 py-1.5 text-sm font-medium text-foreground/80 flex-1">
                            {r.nome}
                            {subsCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({subsCount})</span>}
                          </span>
                        ) : (
                          <>
                            <input
                              ref={(el) => { nomeRefs.current[i] = el; }}
                              list={isSub ? `sub-sugestoes-${r.parent_id}` : undefined}
                              value={r.nome}
                              onChange={(e) => setRow(i, { nome: e.target.value })}
                              placeholder={isSub ? "Nome da subrubrica..." : "Nome da rubrica..."}
                              className="input flex-1"
                            />
                            {isSub && r.parent_id && subSugestoes[r.parent_id] && (
                              <datalist id={`sub-sugestoes-${r.parent_id}`}>
                                {subSugestoes[r.parent_id].map((s, si) => <option key={si} value={s} />)}
                              </datalist>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={r.valor}
                        onChange={(e) => setRow(i, { valor: e.target.value })}
                        placeholder="0,00"
                        className="input text-right"
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <div className="flex items-center gap-0.5 justify-center">
                        {r.isFixed && (
                          <button
                            type="button"
                            onClick={() => {
                              addSubrubrica(r.nome);
                              setExpandedRubricas(prev => new Set([...prev, r.nome]));
                            }}
                            className="text-muted-foreground hover:text-primary p-1"
                            title={`Adicionar subrubrica a "${r.nome}"`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!r.isFixed && (
                          <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-danger p-1">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30 font-medium">
              <tr>
                <td className="p-2">Total interno</td>
                <td className="p-2 text-right tabular-nums">{eur(totInterno)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        <Link to="/gestao" className="px-4 py-2 text-sm rounded-md border border-input">
          Cancelar
        </Link>
        <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground">
          Guardar obra
        </button>
      </div>

      <style>{`.input{width:100%;border:1px solid var(--input);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px}`}</style>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
