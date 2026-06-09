import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur, estadoLabel, estadoColor } from "@/lib/format";
import { ArrowLeft, Edit, X } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard, SkeletonTable } from "@/components/SkeletonTable";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes_/$id")({
  component: () => <Protected allow={["admin", "gestor"]}><Page /></Protected>,
});

interface Cliente { id: string; nome: string; nif: string | null; telefone: string | null }
interface ObraRow { id: string; nome: string; estado: string; orc_cliente: number; ad_cli: number; ad_int: number; orc_interno: number; gasto: number }

function Page() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [rows, setRows] = useState<ObraRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const { data: c } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
    setCliente(c as Cliente | null);
    const { data: obras } = await supabase.from("obras").select("id,nome,estado,orcamento_cliente").eq("cliente_id", id).order("created_at", { ascending: false });
    const ids = (obras ?? []).map((o: any) => o.id);
    const [{ data: rub }, { data: lan }, { data: ad }] = await Promise.all([
      ids.length ? supabase.from("rubricas").select("obra_id,orcamento_interno").in("obra_id", ids) : Promise.resolve({ data: [] as any }),
      ids.length ? supabase.from("lancamentos").select("obra_id,valor").in("obra_id", ids) : Promise.resolve({ data: [] as any }),
      ids.length ? supabase.from("adendas").select("id,obra_id,valor_cliente").in("obra_id", ids) : Promise.resolve({ data: [] as any }),
    ]);
    const adIds = (ad ?? []).map((a: any) => a.id);
    const { data: aRubs } = adIds.length ? await supabase.from("adenda_rubricas").select("adenda_id,valor").in("adenda_id", adIds) : { data: [] as any };
    const map = new Map<string, ObraRow>();
    (obras ?? []).forEach((o: any) => map.set(o.id, { id: o.id, nome: o.nome, estado: o.estado, orc_cliente: Number(o.orcamento_cliente), orc_interno: 0, gasto: 0, ad_cli: 0, ad_int: 0 }));
    (rub ?? []).forEach((r: any) => { const o = map.get(r.obra_id); if (o) o.orc_interno += Number(r.orcamento_interno); });
    const adObra = new Map<string, string>();
    (ad ?? []).forEach((a: any) => { adObra.set(a.id, a.obra_id); const o = map.get(a.obra_id); if (o) o.ad_cli += Number(a.valor_cliente); });
    (aRubs ?? []).forEach((r: any) => { const ob = adObra.get(r.adenda_id); if (!ob) return; const o = map.get(ob); if (o) o.ad_int += Number(r.valor); });
    (lan ?? []).forEach((l: any) => { const o = map.get(l.obra_id); if (o) o.gasto += Number(l.valor); });
    setRows(Array.from(map.values()));
  }
  useEffect(() => { load(); }, [id]);

  const totFat = rows.reduce((s, r) => s + r.orc_cliente + r.ad_cli, 0);
  const totGasto = rows.reduce((s, r) => s + r.gasto, 0);
  const margemMedia = totFat > 0 ? ((totFat - totGasto) / totFat) * 100 : 0;

  if (!cliente) return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <SkeletonCard />
      <SkeletonTable rows={3} cols={5} />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <Link to="/clientes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{cliente.nome}</h1>
          <div className="text-sm text-muted-foreground mt-1">
            {cliente.nif && <span>NIF: {cliente.nif}</span>}
            {cliente.nif && cliente.telefone && " · "}
            {cliente.telefone && <span>Tel: {cliente.telefone}</span>}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="border border-input px-3 py-2 rounded-md text-sm inline-flex items-center gap-1">
            <Edit className="w-4 h-4" /> Editar
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h2 className="font-medium">Obras</h2></div>
        {rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Sem obras associadas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Orç. cliente</th>
                  <th className="text-right p-3">Total faturável</th>
                  <th className="text-right p-3">Gasto real</th>
                  <th className="text-right p-3">Margem %</th>
                  <th className="text-center p-3">Sem.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const fat = r.orc_cliente + r.ad_cli;
                  const m = fat - r.gasto;
                  const pct = fat > 0 ? (m / fat) * 100 : 0;
                  const sem = pct > 10 ? "bg-success" : pct >= 0 ? "bg-warning" : "bg-danger";
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3"><Link to="/obras/$id" params={{ id: r.id }} className="font-medium text-primary hover:underline">{r.nome}</Link></td>
                      <td className="p-3"><span className={`text-xs px-2 py-1 rounded-md font-medium ${estadoColor[r.estado]}`}>{estadoLabel[r.estado]}</span></td>
                      <td className="p-3 text-right tabular-nums">{eur(r.orc_cliente)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(fat)}</td>
                      <td className="p-3 text-right tabular-nums">{eur(r.gasto)}</td>
                      <td className={`p-3 text-right tabular-nums ${pct >= 0 ? "" : "text-danger"}`}>{pct.toFixed(1)}%</td>
                      <td className="p-3 text-center"><span className={`inline-block w-3 h-3 rounded-full ${sem}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td colSpan={3} className="p-3">Totais</td>
                  <td className="p-3 text-right tabular-nums">{eur(totFat)}</td>
                  <td className="p-3 text-right tabular-nums">{eur(totGasto)}</td>
                  <td className="p-3 text-right tabular-nums">{margemMedia.toFixed(1)}%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {showForm && cliente && <ClienteForm cliente={cliente} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ClienteForm({ cliente, onClose, onSaved }: { cliente: Cliente; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(cliente.nome ?? "");
  const [nif, setNif] = useState(cliente.nif ?? "");
  const [telefone, setTelefone] = useState(cliente.telefone ?? "");

  async function save() {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("clientes").update({ nome: nome.trim(), nif: nif || null, telefone: telefone || null }).eq("id", cliente.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente guardado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-end" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card w-full sm:max-w-md sm:h-full p-5 space-y-3 rounded-t-lg sm:rounded-none">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Editar cliente</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <label className="block text-sm"><span className="text-muted-foreground">Nome *</span>
          <input value={nome} onChange={e => setNome(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background" />
        </label>
        <label className="block text-sm"><span className="text-muted-foreground">NIF</span>
          <input value={nif} onChange={e => setNif(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background" />
        </label>
        <label className="block text-sm"><span className="text-muted-foreground">Telefone</span>
          <input value={telefone} onChange={e => setTelefone(e.target.value)} className="mt-1 w-full border border-input rounded-md px-3 py-2 bg-background" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={save} className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">Guardar</button>
        </div>
      </div>
    </div>
  );
}
