import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { Modal, Field } from "./obras.$id";
import { Plus, Users, Edit, X, Trash2, Copy, MapPin } from "lucide-react";
import { estadoLabel, eur } from "@/lib/format";
import { EstadoFilter, ESTADOS_DEFAULT } from "@/components/EstadoFilter";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao")({
  component: () => <Protected allow={["admin"]}><Gestao /></Protected>,
});

interface Obra { id: string; nome: string; cliente: string; cliente_id: string | null; localizacao: string | null; estado: string; orcamento_cliente: number; cliente_nome?: string; data_fim_previsto: string | null; responsavel_interno_id: string | null; responsavel_nome?: string }
interface Profile { id: string; nome: string; email: string | null }
interface Colaborador { id: string; nome: string }
interface ObraUser { id: string; user_id: string; obra_id: string }

function Gestao() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [assignFor, setAssignFor] = useState<Obra | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [deleteFor, setDeleteFor] = useState<Obra | null>(null);
  const [q, setQ] = useState("");
  const [estados, setEstados] = useState<string[]>(ESTADOS_DEFAULT);

    useEffect(() => { document.title = "Gestão — ObraControl"; return () => { document.title = "ObraControl"; }; }, []);
  useEffect(() => { load(); }, []);

  async function duplicarObra(o: Obra) {
    const { data: rubricas } = await supabase.from("rubricas").select("nome,orcamento_interno").eq("obra_id", o.id).is("parent_id", null);
    const { data: nova, error } = await supabase.from("obras").insert({
      nome: `${o.nome} (cópia)`, cliente: o.cliente, cliente_id: o.cliente_id,
      localizacao: o.localizacao, estado: "orcamentacao", orcamento_cliente: o.orcamento_cliente,
    }).select("id").maybeSingle();
    if (error || !nova) { toast.error(error?.message ?? "Erro"); return; }
    if (rubricas && rubricas.length > 0) {
      await supabase.from("rubricas").insert(rubricas.map((r: any) => ({ obra_id: nova.id, nome: r.nome, orcamento_interno: r.orcamento_interno })));
    }
    toast.success(`Obra duplicada como "${o.nome} (cópia)"`);
    load();
  }

  async function load() {
    const { data } = await supabase.from("obras").select("id,nome,cliente,cliente_id,localizacao,estado,orcamento_cliente,data_fim_previsto,responsavel_interno_id").order("created_at", { ascending: false });
    const { data: colabs } = await supabase.from("colaboradores").select("id,nome").eq("ativo", true);
    setColaboradores((colabs ?? []) as Colaborador[]);
    const arr = (data ?? []) as Obra[];
    const ids = Array.from(new Set(arr.map(o => o.cliente_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: cs } = await supabase.from("clientes").select("id,nome").in("id", ids);
      const m = new Map((cs ?? []).map((c: any) => [c.id, c.nome]));
      arr.forEach(o => { if (o.cliente_id) o.cliente_nome = m.get(o.cliente_id); });
    }
    const collabMap = new Map(((await supabase.from('colaboradores' as any).select('id,nome')).data ?? []).map((c: any) => [c.id, c.nome]));
    arr.forEach(o => { if ((o as any).responsavel_interno_id) o.responsavel_nome = collabMap.get((o as any).responsavel_interno_id); });
    setObras(arr);
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gestão</h1>
          <p className="text-sm text-muted-foreground">Gestão de obras e equipa</p>
        </div>
        <Link to="/gestao/obras/$id" params={{ id: "novo" }} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nova obra
        </Link>
      </div>

      {/* Submenu de configurações */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-border">
        <span className="text-xs text-muted-foreground self-center pr-1">Configurações:</span>
        <Link to="/clientes" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Clientes</Link>
        <Link to="/gestao/rubricas" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Rubricas padrão</Link>
        <Link to="/gestao/colaboradores" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Colaboradores</Link>
        <Link to="/gestao/fornecedores" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Fornecedores</Link>
        <Link to="/gestao/unidades" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Unidades</Link>
        <Link to="/gestao/utilizadores" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Utilizadores</Link>
        <Link to="/gestao/auditoria" className="text-xs border border-input px-2.5 py-1.5 rounded-md hover:bg-muted">Auditoria</Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 Pesquisar obra ou cliente..."
          className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background"
        />
        <EstadoFilter value={estados} onChange={setEstados} />
        {(q || estados.length !== ESTADOS_DEFAULT.length || !ESTADOS_DEFAULT.every(e => estados.includes(e))) && (
          <button onClick={() => { setQ(""); setEstados(ESTADOS_DEFAULT); }} className="border border-input rounded-md px-3 py-2 text-sm">Limpar</button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-right p-3">Orç. cliente</th>
              <th className="text-left p-3">Responsável</th>
              <th className="text-left p-3">Prazo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const filtered = obras.filter(o => {
                const m = q.trim().toLowerCase();
                const cliText = (o.cliente_nome || o.cliente || "").toLowerCase();
                const okQ = !m || o.nome.toLowerCase().includes(m) || cliText.includes(m);
                const okE = estados.length === 0 || estados.includes(o.estado);
                return okQ && okE;
              });
              if (obras.length === 0) return <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem obras.</td></tr>;
              if (filtered.length === 0) return <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma obra encontrada.</td></tr>;
              return filtered.map(o => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Link to="/obras/$id" params={{ id: o.id }} className="font-medium hover:underline text-primary cursor-pointer">{o.nome}</Link>
                    {o.localizacao && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.localizacao)}`} target="_blank" rel="noopener noreferrer" title={o.localizacao} className="text-muted-foreground hover:text-primary">
                        <MapPin className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{o.cliente_nome || o.cliente}</td>
                <td className="p-3">
                  <select
                    value={o.estado}
                    onChange={async e => {
                      const novo = e.target.value;
                      const { error } = await supabase.from("obras").update({ estado: novo as any }).eq("id", o.id);
                      if (error) toast.error(error.message);
                      else { toast.success("Estado actualizado"); load(); }
                    }}
                    className="text-xs border border-input rounded-md px-2 py-1 bg-background"
                  >
                    {Object.entries(estadoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="p-3 text-right tabular-nums">{eur(o.orcamento_cliente)}</td>
                <td className="p-3 text-sm text-muted-foreground">{(o as any).responsavel_nome || "—"}</td>
                <td className="p-3 text-sm tabular-nums">
                  {(o as any).data_fim_previsto ? (() => {
                    const dias = Math.round((new Date((o as any).data_fim_previsto).getTime() - Date.now()) / 86400000);
                    return <span className={dias < 0 ? "text-danger" : dias <= 14 ? "text-amber-500" : "text-muted-foreground"}>{(o as any).data_fim_previsto}</span>;
                  })() : "—"}
                </td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => setAssignFor(o)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Users className="w-4 h-4" /> Encarregados
                  </button>
                  <button onClick={() => duplicarObra(o)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Copy className="w-4 h-4" /> Duplicar
                  </button>
                  <Link to="/gestao/obras/$id" params={{ id: o.id }} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Edit className="w-4 h-4" /> Editar
                  </Link>
                  <button onClick={() => setDeleteFor(o)} className="text-sm text-muted-foreground hover:text-danger inline-flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Eliminar
                  </button>
                </td>
              </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>

      {assignFor && <AssignModal obra={assignFor} onClose={() => setAssignFor(null)} />}
      {deleteFor && <DeleteModal obra={deleteFor} onClose={() => setDeleteFor(null)} onDeleted={() => { setDeleteFor(null); load(); }} />}
    </div>
  );
}

function AssignModal({ obra, onClose }: { obra: Obra; onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assigned, setAssigned] = useState<ObraUser[]>([]);
  const [pick, setPick] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    const [{ data: pf }, { data: au }] = await Promise.all([
      supabase.from("profiles").select("id,nome,email"),
      supabase.from("obra_utilizadores").select("id,user_id,obra_id").eq("obra_id", obra.id),
    ]);
    setProfiles((pf ?? []) as Profile[]);
    setAssigned((au ?? []) as ObraUser[]);
  }
  async function add() {
    if (!pick) return;
    const { error } = await supabase.from("obra_utilizadores").insert({ obra_id: obra.id, user_id: pick, perfil: "encarregado" });
    if (error) toast.error(error.message); else { setPick(""); load(); }
  }
  async function remove(id: string) {
    const { error } = await supabase.from("obra_utilizadores").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  const available = profiles.filter(p => !assigned.some(a => a.user_id === p.id));

  return (
    <Modal title={`Encarregados — ${obra.nome}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <select value={pick} onChange={e => setPick(e.target.value)} className="input flex-1">
            <option value="">— escolher utilizador —</option>
            {available.map(p => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
          </select>
          <button onClick={add} className="bg-primary text-primary-foreground px-3 rounded-md text-sm">Adicionar</button>
        </div>
        <ul className="border border-border rounded-md divide-y divide-border">
          {assigned.map(a => {
            const p = profiles.find(x => x.id === a.user_id);
            return (
              <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{p?.nome || p?.email || a.user_id}</span>
                <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-danger"><X className="w-4 h-4" /></button>
              </li>
            );
          })}
          {assigned.length === 0 && <li className="px-3 py-3 text-center text-sm text-muted-foreground">Sem encarregados</li>}
        </ul>
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Fechar</button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteModal({ obra, onClose, onDeleted }: { obra: Obra; onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (confirm !== obra.nome) { toast.error("O nome da obra não corresponde"); return; }
    if (!password) { toast.error("Introduza a sua password"); return; }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) { toast.error("Sessão inválida"); setLoading(false); return; }

      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) { toast.error("Password incorrecta"); setLoading(false); return; }

      // Cascade delete dependent rows (no FK cascades defined)
      const { data: adendas } = await supabase.from("adendas").select("id").eq("obra_id", obra.id);
      const adendaIds = (adendas ?? []).map((a: any) => a.id);
      if (adendaIds.length) {
        await supabase.from("adenda_rubricas").delete().in("adenda_id", adendaIds);
      }
      await Promise.all([
        supabase.from("lancamentos").delete().eq("obra_id", obra.id),
        supabase.from("rubricas").delete().eq("obra_id", obra.id),
        supabase.from("obra_utilizadores").delete().eq("obra_id", obra.id),
        supabase.from("adendas").delete().eq("obra_id", obra.id),
        supabase.from("faturas_emitidas").delete().eq("obra_id", obra.id),
        supabase.from("obra_estado_log").delete().eq("obra_id", obra.id),
      ]);
      const { error } = await supabase.from("obras").delete().eq("id", obra.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Obra eliminada");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro a eliminar");
      setLoading(false);
    }
  }

  return (
    <Modal title={`Eliminar obra — ${obra.nome}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="p-3 rounded-md bg-danger/10 border border-danger/30 text-danger">
          <strong>Atenção:</strong> esta acção é irreversível. Serão eliminados todos os lançamentos, rubricas, adendas, facturas e atribuições desta obra.
        </div>
        <Field label={`Para confirmar, escreva o nome da obra: "${obra.nome}"`}>
          <input value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full border border-input bg-background rounded-md px-3 py-2" />
        </Field>
        <Field label="A sua password">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border border-input bg-background rounded-md px-3 py-2" autoComplete="current-password" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={loading} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={handleDelete} disabled={loading} className="px-3 py-2 text-sm rounded-md bg-danger text-white disabled:opacity-60">
            {loading ? "A eliminar..." : "Eliminar definitivamente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Re-export Field so other files can keep import
export { Field };
