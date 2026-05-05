import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur, tipoLabel } from "@/lib/format";
import { Modal, Field, ModalActions } from "./obras.$id";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/rubricas/$id")({
  component: () => <Protected><RubricaPage /></Protected>,
});

interface Rubrica { id: string; obra_id: string; nome: string; tipo: string; orcamento_interno: number }
interface Lanc {
  id: string; data: string; descricao: string; fornecedor: string | null;
  num_documento: string | null; num_homens: number | null; valor: number;
}

function RubricaPage() {
  const { id } = Route.useParams();
  const [rub, setRub] = useState<Rubrica | null>(null);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => { load(); }, [id]);
  async function load() {
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from("rubricas").select("*").eq("id", id).maybeSingle(),
      supabase.from("lancamentos").select("*").eq("rubrica_id", id).order("data", { ascending: false }),
    ]);
    setRub(r as Rubrica | null);
    setLancs((l ?? []) as Lanc[]);
  }
  if (!rub) return <div className="p-8 text-muted-foreground">A carregar...</div>;

  const total = lancs.reduce((s, l) => s + Number(l.valor), 0);
  const showFornecedor = ["materiais", "subempreitada", "equipamento", "outro"].includes(rub.tipo);
  const showHomens = rub.tipo === "mao_de_obra";

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <Link to="/obras/$id" params={{ id: rub.obra_id }} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar à obra
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{rub.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {tipoLabel[rub.tipo]} · Orç. interno {eur(rub.orcamento_interno)} · Gasto {eur(total)}
            </p>
          </div>
          <button onClick={() => setShow(true)} className="text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md inline-flex items-center gap-1">
            <Plus className="w-4 h-4" /> Lançamento
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Descrição</th>
              {showFornecedor && <th className="text-left p-3">Fornecedor</th>}
              {showFornecedor && <th className="text-left p-3">Nº doc</th>}
              {showHomens && <th className="text-right p-3">Nº homens</th>}
              <th className="text-right p-3">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancs.map(l => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground">{l.data}</td>
                <td className="p-3">{l.descricao}</td>
                {showFornecedor && <td className="p-3">{l.fornecedor ?? "—"}</td>}
                {showFornecedor && <td className="p-3 text-muted-foreground">{l.num_documento ?? "—"}</td>}
                {showHomens && <td className="p-3 text-right tabular-nums">{l.num_homens ?? "—"}</td>}
                <td className="p-3 text-right tabular-nums">{eur(l.valor)}</td>
              </tr>
            ))}
            {lancs.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem lançamentos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {show && <LancModal rub={rub} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}

function LancModal({ rub, onClose, onSaved }: { rub: Rubrica; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [doc, setDoc] = useState("");
  const [homens, setHomens] = useState("");
  const [valor, setValor] = useState("0");

  const showFornecedor = ["materiais", "subempreitada", "equipamento", "outro"].includes(rub.tipo);
  const showHomens = rub.tipo === "mao_de_obra";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("lancamentos").insert({
      rubrica_id: rub.id, obra_id: rub.obra_id, data, descricao,
      fornecedor: showFornecedor && fornecedor ? fornecedor : null,
      num_documento: showFornecedor && doc ? doc : null,
      num_homens: showHomens && homens ? Number(homens) : null,
      valor: Number(valor),
      registado_por: user.id,
    });
    if (error) toast.error(error.message); else { toast.success("Lançamento registado"); onSaved(); }
  }

  return (
    <Modal title="Novo lançamento" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} className="input" required /></Field>
          <Field label="Valor (€)"><input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="input" required /></Field>
        </div>
        <Field label="Descrição"><input value={descricao} onChange={e => setDescricao(e.target.value)} className="input" required /></Field>
        {showFornecedor && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fornecedor"><input value={fornecedor} onChange={e => setFornecedor(e.target.value)} className="input" /></Field>
            <Field label="Nº documento"><input value={doc} onChange={e => setDoc(e.target.value)} className="input" /></Field>
          </div>
        )}
        {showHomens && (
          <Field label="Nº homens"><input type="number" value={homens} onChange={e => setHomens(e.target.value)} className="input" /></Field>
        )}
        <ModalActions onClose={onClose} />
      </form>
    </Modal>
  );
}
