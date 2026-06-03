import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Check, X, Pencil, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/gestao_/rubricas")({
  component: () => (
    <Protected allow={["admin"]}>
      <Page />
    </Protected>
  ),
});

interface Rub {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  parent_id: string | null;
}

const RUBRICAS_FIXAS = ["Mão de Obra Própria", "Materiais", "Subempreitada"];

function Page() {
  const [rows, setRows] = useState<Rub[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [usados, setUsados] = useState<Set<string>>(new Set());
  const [delRub, setDelRub] = useState<Rub | null>(null);
  const [addingSubOf, setAddingSubOf] = useState<string | null>(null);
  const [subNome, setSubNome] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ data }, { data: r }, { data: ar }] = await Promise.all([
      supabase.from("rubricas_padrao").select("*").order("ordem"),
      supabase.from("rubricas").select("nome"),
      supabase.from("adenda_rubricas").select("nome"),
    ]);
    setRows((data ?? []) as any as Rub[]);
    const u = new Set<string>();
    (r ?? []).forEach((x: any) => u.add(x.nome));
    (ar ?? []).forEach((x: any) => u.add(x.nome));
    setUsados(u);
  }

  async function novo() {
    const maxOrdem = rows.filter((r) => !r.parent_id).reduce((m, r) => Math.max(m, r.ordem), 0);
    const { data, error } = await supabase
      .from("rubricas_padrao")
      .insert({ nome: "Nova rubrica", ordem: maxOrdem + 1, parent_id: null } as any)
      .select("*")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Erro");
      return;
    }
    setRows((rs) => [...rs, data as any as Rub]);
    setEditId((data as any as Rub).id);
    setEditNome((data as any as Rub).nome);
  }

  async function novaSubrubrica(parentId: string) {
    if (!subNome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const maxOrdem = rows.filter((r) => r.parent_id === parentId).reduce((m, r) => Math.max(m, r.ordem), 0);
    const { data, error } = await supabase
      .from("rubricas_padrao")
      .insert({ nome: subNome.trim(), ordem: maxOrdem + 1, parent_id: parentId } as any)
      .select("*")
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Erro");
      return;
    }
    setAddingSubOf(null);
    setSubNome("");
    load();
    toast.success("Subrubrica criada");
  }

  async function saveNome(id: string) {
    if (!editNome.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    const { error } = await supabase.from("rubricas_padrao").update({ nome: editNome.trim() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditId(null);
    load();
  }

  async function toggleAtivo(r: Rub) {
    if (RUBRICAS_FIXAS.includes(r.nome) && r.ativo) {
      toast.error("As rubricas base não podem ser desactivadas");
      return;
    }
    const { error } = await supabase.from("rubricas_padrao").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  }

  function pedirApagar(r: Rub) {
    if (RUBRICAS_FIXAS.includes(r.nome)) {
      toast.error("As rubricas base não podem ser apagadas");
      return;
    }
    if (usados.has(r.nome)) {
      toast.error("Rubrica em uso, não pode ser apagada");
      return;
    }
    setDelRub(r);
  }
  async function apagarConfirmado() {
    if (!delRub) return;
    const { error } = await supabase.from("rubricas_padrao").delete().eq("id", delRub.id);
    if (error) toast.error(error.message);
    else load();
  }

  async function mover(r: Rub, dir: -1 | 1) {
    const peers = [...rows].filter((x) => x.parent_id === r.parent_id).sort((a, b) => a.ordem - b.ordem);
    const i = peers.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= peers.length) return;
    const a = peers[i],
      b = peers[j];
    await Promise.all([
      supabase.from("rubricas_padrao").update({ ordem: b.ordem }).eq("id", a.id),
      supabase.from("rubricas_padrao").update({ ordem: a.ordem }).eq("id", b.id),
    ]);
    load();
  }

  const parents = rows.filter((r) => !r.parent_id).sort((a, b) => a.ordem - b.ordem);
  const flatList: { rub: Rub; isSub: boolean }[] = [];
  parents.forEach((p) => {
    flatList.push({ rub: p, isSub: false });
    rows
      .filter((r) => r.parent_id === p.id)
      .sort((a, b) => a.ordem - b.ordem)
      .forEach((s) => {
        flatList.push({ rub: s, isSub: true });
      });
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      <div>
        <Link
          to="/gestao"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Rubricas padrão</h1>
            <p className="text-xs text-muted-foreground mt-1">
              As rubricas <strong>Mão de Obra Própria</strong>, <strong>Materiais</strong> e{" "}
              <strong>Subempreitada</strong> estão sempre presentes em todas as obras.
            </p>
          </div>
          <button
            onClick={novo}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Nova rubrica
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3 w-24">Ordem</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 w-24">Activa</th>
              <th className="p-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {flatList.map(({ rub: r, isSub }) => {
              const isFixed = RUBRICAS_FIXAS.includes(r.nome);
              return (
                <tr key={r.id} className={`border-t border-border ${isSub ? "bg-muted/20" : ""}`}>
                  <td className="p-2">
                    <div className="flex gap-1 items-center">
                      {isSub && <ChevronRight className="w-3 h-3 text-muted-foreground ml-3 shrink-0" />}
                      <button onClick={() => mover(r, -1)} className="text-muted-foreground hover:text-foreground p-1">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => mover(r, 1)} className="text-muted-foreground hover:text-foreground p-1">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className={`p-2 ${isSub ? "pl-8" : ""}`}>
                    {editId === r.id ? (
                      <div className="flex gap-1">
                        <input
                          autoFocus
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNome(r.id);
                            if (e.key === "Escape") setEditId(null);
                          }}
                          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button onClick={() => saveNome(r.id)} className="text-success p-1">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-danger p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditId(r.id);
                            setEditNome(r.nome);
                          }}
                          className="text-left hover:text-primary"
                        >
                          {r.nome}
                        </button>
                        {isFixed && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-1">base</span>
                        )}
                      </div>
                    )}
                    {addingSubOf === r.id && (
                      <div className="mt-2 flex gap-2 items-center pl-4">
                        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <input
                          autoFocus
                          value={subNome}
                          onChange={(e) => setSubNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") novaSubrubrica(r.id);
                            if (e.key === "Escape") {
                              setAddingSubOf(null);
                              setSubNome("");
                            }
                          }}
                          placeholder="Nome da subrubrica..."
                          className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button onClick={() => novaSubrubrica(r.id)} className="text-success p-1">
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setAddingSubOf(null);
                            setSubNome("");
                          }}
                          className="text-muted-foreground hover:text-danger p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={r.ativo}
                      onChange={() => toggleAtivo(r)}
                      className="w-4 h-4"
                      disabled={isFixed && r.ativo}
                    />
                  </td>
                  <td className="p-2 text-right space-x-1 whitespace-nowrap">
                    {!isSub && (
                      <button
                        onClick={() => {
                          setAddingSubOf(r.id);
                          setSubNome("");
                        }}
                        className="text-muted-foreground hover:text-primary p-1"
                        title="Adicionar subrubrica"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditId(r.id);
                        setEditNome(r.nome);
                      }}
                      className="text-muted-foreground hover:text-foreground p-1"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => pedirApagar(r)}
                      disabled={isFixed || usados.has(r.nome)}
                      className={`p-1 ${isFixed || usados.has(r.nome) ? "text-muted-foreground/40 cursor-not-allowed" : "text-muted-foreground hover:text-danger"}`}
                      title={isFixed ? "Rubrica base" : usados.has(r.nome) ? "Em uso" : "Apagar"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Sem rubricas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PasswordConfirmDialog
        open={!!delRub}
        title={`Apagar rubrica padrão — ${delRub?.nome ?? ""}`}
        description="Confirme com a sua password."
        onClose={() => setDelRub(null)}
        onConfirmed={apagarConfirmado}
      />
    </div>
  );
}
