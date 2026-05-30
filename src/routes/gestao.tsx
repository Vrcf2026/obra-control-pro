import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { Modal, Field } from "./obras.$id";
import { Plus, Users, Edit, X, Trash2 } from "lucide-react";
import { estadoLabel, eur } from "@/lib/format";
import { EstadoFilter, ESTADOS_DEFAULT } from "@/components/EstadoFilter";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao")({
  component: () => <Protected allow={["admin"]}><Gestao /></Protected>,
});

interface Obra { id: string; nome: string; cliente: string; cliente_id: string | null; localizacao: string | null; estado: string; orcamento_cliente: number; cliente_nome?: string }
interface Profile { id: string; nome: string; email: string | null }
interface ObraUser { id: string; user_id: string; obra_id: string }

function Gestao() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [assignFor, setAssignFor] = useState<Obra | null>(null);
  const [q, setQ] = useState("");
  const [estados, setEstados] = useState<string[]>(ESTADOS_DEFAULT);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("obras").select("id,nome,cliente,cliente_id,localizacao,estado,orcamento_cliente").order("created_at", { ascending: false });
    const arr = (data ?? []) as Obra[];
    const ids = Array.from(new Set(arr.map(o => o.cliente_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: cs } = await supabase.from("clientes").select("id,nome").in("id", ids);
      const m = new Map((cs ?? []).map((c: any) => [c.id, c.nome]));
      arr.forEach(o => { if (o.cliente_id) o.cliente_nome = m.get(o.cliente_id); });
    }
    setObras(arr);
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gestão</h1>
          <p className="text-sm text-muted-foreground">Gestão de obras e equipa</p>
        </div>
        <div className="flex gap-2">
          <Link to="/gestao/rubricas" className="border border-input px-3 py-2 rounded-md text-sm">Rubricas padrão</Link>
          <Link to="/gestao/utilizadores" className="border border-input px-3 py-2 rounded-md text-sm">Utilizadores</Link>
          <Link to="/gestao/obras/$id" params={{ id: "novo" }} className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Nova obra
          </Link>
        </div>
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
              if (obras.length === 0) return <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem obras.</td></tr>;
              if (filtered.length === 0) return <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma obra encontrada.</td></tr>;
              return filtered.map(o => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3"><Link to="/obras/$id" params={{ id: o.id }} className="font-medium hover:underline text-primary cursor-pointer">{o.nome}</Link></td>
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
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => setAssignFor(o)} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Users className="w-4 h-4" /> Encarregados
                  </button>
                  <Link to="/gestao/obras/$id" params={{ id: o.id }} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <Edit className="w-4 h-4" /> Editar
                  </Link>
                </td>
              </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>

      {assignFor && <AssignModal obra={assignFor} onClose={() => setAssignFor(null)} />}
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

// Re-export Field so other files can keep import
export { Field };
