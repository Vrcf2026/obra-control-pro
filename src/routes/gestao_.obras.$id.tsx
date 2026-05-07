import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { eur } from "@/lib/format";
import { ArrowLeft, Plus, X, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { RubricaSelect } from "@/components/RubricaSelect";

export const Route = createFileRoute("/gestao_/obras/$id")({
  component: () => <Protected allow={["admin"]}><Editor /></Protected>,
});

interface RubricaRow { id?: string; nome: string; valor: string }

interface Cliente { id: string; nome: string; nif: string | null; telefone: string | null }

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
  const [orcCliente, setOrcCliente] = useState("0");
  const [rubricas, setRubricas] = useState<RubricaRow[]>([{ nome: "", valor: "" }]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const nomeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("clientes").select("id,nome,nif,telefone").order("nome");
    setClientes((data ?? []) as Cliente[]);
  })(); }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const [{ data: o }, { data: r }] = await Promise.all([
        supabase.from("obras").select("*").eq("id", id).maybeSingle(),
        supabase.from("rubricas").select("*").eq("obra_id", id).order("created_at"),
      ]);
      if (o) {
        setNome(o.nome); setCliente(o.cliente); setLoc(o.localizacao ?? "");
        setClienteId((o as any).cliente_id ?? "");
        setEstado(o.estado); setIni(o.data_inicio ?? ""); setFim(o.data_fim_previsto ?? "");
        setOrcCliente(String((o as { orcamento_cliente: number }).orcamento_cliente ?? 0));
      }
      const rs = (r ?? []).map(x => ({ id: x.id, nome: x.nome, valor: String(x.orcamento_interno) }));
      setRubricas(rs.length ? rs : [{ nome: "", valor: "" }]);
      setOriginalIds(rs.filter(x => x.id).map(x => x.id!));
      setLoading(false);
    })();
  }, [id, isNew]);

  async function criarCliente() {
    if (!novoNome.trim()) { toast.error("Nome do cliente obrigatório"); return; }
    const { data, error } = await supabase.from("clientes")
      .insert({ nome: novoNome.trim(), nif: novoNif || null, telefone: novoTel || null })
      .select("id,nome,nif,telefone").maybeSingle();
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    setClientes(cs => [...cs, data as Cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
    setClienteId(data.id);
    setCliente(data.nome);
    setShowNovoCliente(false);
    setNovoNome(""); setNovoNif(""); setNovoTel("");
    toast.success("Cliente criado");
  }


  function setRow(i: number, patch: Partial<RubricaRow>) {
    setRubricas(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function addRow() {
    setRubricas(rs => [...rs, { nome: "", valor: "" }]);
    setTimeout(() => nomeRefs.current[rubricas.length]?.focus(), 0);
  }
  function removeRow(i: number) { setRubricas(rs => rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)); }

  function onValorKey(e: React.KeyboardEvent, i: number) {
    if (e.key === "Enter" || e.key === "Tab") {
      if (i === rubricas.length - 1) {
        e.preventDefault();
        setRubricas(rs => [...rs, { nome: "", valor: "" }]);
        setTimeout(() => nomeRefs.current[i + 1]?.focus(), 0);
      }
    }
  }

  async function importXlsx(file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const parsed: RubricaRow[] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const a = row[0]; const b = row[1];
      const nomeCell = a == null ? "" : String(a).trim();
      const valNum = Number(String(b ?? "").replace(",", "."));
      if (!nomeCell) continue;
      // Skip header-like rows
      if (parsed.length === 0 && isNaN(valNum)) continue;
      parsed.push({ nome: nomeCell, valor: isNaN(valNum) ? "" : String(valNum) });
    }
    if (parsed.length === 0) { toast.error("Nenhuma linha válida no ficheiro"); return; }
    setRubricas(parsed);
    toast.success(`${parsed.length} rubricas importadas`);
  }

  const totInterno = rubricas.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  async function save() {
    if (!nome || !cliente) { toast.error("Nome e cliente obrigatórios"); return; }
    const payload = {
      nome, cliente, cliente_id: clienteId || null, localizacao: loc || null, estado: estado as never,
      data_inicio: ini || null, data_fim_previsto: fim || null,
      orcamento_cliente: Number(orcCliente),
    };

    let obraId = id;
    if (isNew) {
      const { data, error } = await supabase.from("obras").insert(payload).select("id").maybeSingle();
      if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
      obraId = data.id;
    } else {
      const { error } = await supabase.from("obras").update(payload).eq("id", id);
      if (error) { toast.error(error.message); return; }
    }

    const validRows = rubricas.filter(r => r.nome.trim());
    const keepIds = validRows.filter(r => r.id).map(r => r.id!);
    const toDelete = originalIds.filter(oid => !keepIds.includes(oid));
    if (toDelete.length) await supabase.from("rubricas").delete().in("id", toDelete);

    for (const r of validRows) {
      if (r.id) {
        await supabase.from("rubricas").update({ nome: r.nome, orcamento_interno: Number(r.valor) || 0 }).eq("id", r.id);
      } else {
        await supabase.from("rubricas").insert({ obra_id: obraId, nome: r.nome, orcamento_interno: Number(r.valor) || 0 });
      }
    }

    toast.success("Obra guardada");
    navigate({ to: "/gestao" });
  }

  if (loading) return <div className="p-8 text-muted-foreground">A carregar...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div>
        <Link to="/gestao" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{isNew ? "Nova obra" : "Editar obra"}</h1>
      </div>

      {/* Parte 1 */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="font-medium">Dados gerais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <F label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} className="input" /></F>
          <F label="Cliente">
            <select value={clienteId} onChange={e => {
              const v = e.target.value;
              if (v === "__novo__") { setShowNovoCliente(true); return; }
              setClienteId(v);
              const c = clientes.find(x => x.id === v);
              if (c) setCliente(c.nome);
            }} className="input">
              <option value="">— escolher cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              <option value="__novo__">+ Novo cliente</option>
            </select>
            {showNovoCliente && (
              <div className="mt-2 p-3 border border-border rounded-md bg-muted/30 space-y-2">
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome *" className="input" />
                <input value={novoNif} onChange={e => setNovoNif(e.target.value)} placeholder="NIF" className="input" />
                <input value={novoTel} onChange={e => setNovoTel(e.target.value)} placeholder="Telefone" className="input" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowNovoCliente(false)} className="px-3 py-1.5 text-xs rounded-md border border-input">Cancelar</button>
                  <button onClick={criarCliente} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground">Criar</button>
                </div>
              </div>
            )}
          </F>
          <F label="Localização"><input value={loc} onChange={e => setLoc(e.target.value)} className="input" /></F>
          <F label="Estado">
            <select value={estado} onChange={e => setEstado(e.target.value)} className="input">
              <option value="orcamentacao">Orçamentação</option>
              <option value="adjudicada">Adjudicada</option>
              <option value="em_curso">Em curso</option>
              <option value="concluida">Concluída</option>
              <option value="faturada">Faturada</option>
            </select>
          </F>
          <F label="Data início"><input type="date" value={ini} onChange={e => setIni(e.target.value)} className="input" /></F>
          <F label="Fim previsto"><input type="date" value={fim} onChange={e => setFim(e.target.value)} className="input" /></F>
          <F label="Orçamento cliente (€)">
            <input type="number" step="0.01" value={orcCliente} onChange={e => setOrcCliente(e.target.value)} className="input" />
          </F>
        </div>
      </section>

      {/* Parte 2 */}
      <section className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Orçamento interno</h2>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} className="text-sm border border-input px-3 py-1.5 rounded-md inline-flex items-center gap-1">
              <Upload className="w-4 h-4" /> Importar Excel
            </button>
            <button onClick={addRow} className="text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md inline-flex items-center gap-1">
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
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rubricas.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-1.5">
                    <RubricaSelect value={r.nome} onChange={nome => setRow(i, { nome })} placeholder="— escolher rubrica —" />
                  </td>
                  <td className="p-1.5">
                    <input type="number" step="0.01" value={r.valor}
                      onChange={e => setRow(i, { valor: e.target.value })}
                      onKeyDown={e => onValorKey(e, i)}
                      placeholder="0,00" className="input text-right" />
                  </td>
                  <td className="p-1.5 text-center">
                    <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-danger"><X className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
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
        <Link to="/gestao" className="px-4 py-2 text-sm rounded-md border border-input">Cancelar</Link>
        <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar obra</button>
      </div>

      <style>{`.input{width:100%;border:1px solid var(--input);background:var(--background);border-radius:6px;padding:8px 10px;font-size:14px}`}</style>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
