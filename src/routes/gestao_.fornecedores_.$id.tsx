import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { eur } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SkeletonCard, SkeletonTable } from "@/components/SkeletonTable";

export const Route = createFileRoute("/gestao_/fornecedores_/$id")({
  component: () => <Protected allow={["admin", "gestor"]}><Page /></Protected>,
});

interface Forn { id: string; nome: string; nif: string | null; telefone: string | null; email: string | null; morada: string | null }
interface Lanc { id: string; obra_id: string; obra_nome: string; rubrica_nome: string; data: string; descricao: string; valor: number; num_documento: string | null }

function Page() {
  const { id } = Route.useParams();
  const [forn, setForn] = useState<Forn | null>(null);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [anos, setAnos] = useState<number[]>([]);

  useEffect(() => { load(); }, [id]);

  async function load() {
    const { data: f } = await supabase.from("fornecedores").select("*").eq("id", id).maybeSingle();
    setForn((f as unknown as Forn) ?? null);

    const { data: l } = await supabase.from("lancamentos").select("id,obra_id,data,descricao,valor,num_documento,rubrica_id")
      .eq("fornecedor_id", id).order("data", { ascending: false });

    if (!l || l.length === 0) { setLancs([]); return; }

    const obraIds = [...new Set((l as any[]).map(x => x.obra_id))];
    const rubricaIds = [...new Set((l as any[]).map(x => x.rubrica_id).filter(Boolean))];

    const [{ data: obras }, { data: rubricas }] = await Promise.all([
      supabase.from("obras").select("id,nome").in("id", obraIds),
      supabase.from("rubricas").select("id,nome,parent_id").in("id", rubricaIds),
    ]);

    const obraMap = new Map((obras ?? []).map((o: any) => [o.id, o.nome]));
    const rubMap = new Map((rubricas ?? []).map((r: any) => [r.id, r]));

    const mapped: Lanc[] = (l as any[]).map(x => {
      const rub = x.rubrica_id ? rubMap.get(x.rubrica_id) : null;
      let rubNome = "—";
      if (rub) {
        if (rub.parent_id) {
          const parent = rubMap.get(rub.parent_id);
          rubNome = parent ? `${parent.nome} › ${rub.nome}` : rub.nome;
        } else rubNome = rub.nome;
      }
      return {
        id: x.id, obra_id: x.obra_id,
        obra_nome: obraMap.get(x.obra_id) ?? "—",
        rubrica_nome: rubNome,
        data: x.data, descricao: x.descricao,
        valor: Number(x.valor),
        num_documento: x.num_documento ?? null,
      };
    });

    const anosSet = new Set<number>(mapped.map(l => new Date(l.data).getFullYear()));
    setAnos(Array.from(anosSet).sort((a, b) => b - a));
    setLancs(mapped);
  }

  const filtrados = lancs.filter(l => new Date(l.data).getFullYear() === ano);
  const total = filtrados.reduce((s, l) => s + l.valor, 0);

  if (!forn) return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <SkeletonCard />
      <SkeletonTable rows={3} cols={6} />
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <Breadcrumb crumbs={[
        { label: "Gestão", to: "/gestao" },
        { label: "Fornecedores", to: "/gestao/fornecedores" },
        { label: forn?.nome ?? "..." },
      ]} />

      <div className="bg-card border border-border rounded-lg p-5">
        <h1 className="text-2xl font-semibold">{forn.nome}</h1>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
          {forn.nif && <span>NIF: {forn.nif}</span>}
          {forn.telefone && <span>{forn.telefone}</span>}
          {forn.email && <span>{forn.email}</span>}
          {forn.morada && <span>{forn.morada}</span>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Lançamentos</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Ano:</span>
            <select value={ano} onChange={e => setAno(Number(e.target.value))}
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
              {anos.length === 0 && <option value={ano}>{ano}</option>}
            </select>
          </div>
        </div>
        {filtrados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Sem lançamentos no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Obra</th>
                  <th className="text-left p-3">Rubrica</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Nº Doc.</th>
                  <th className="text-right p-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="p-3 tabular-nums text-muted-foreground">{l.data}</td>
                    <td className="p-3">
                      <Link to="/obras/$id" params={{ id: l.obra_id }} className="hover:underline text-primary">{l.obra_nome}</Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{l.rubrica_nome}</td>
                    <td className="p-3">{l.descricao || "—"}</td>
                    <td className="p-3 text-muted-foreground">{l.num_documento || "—"}</td>
                    <td className={`p-3 text-right tabular-nums font-medium ${l.valor < 0 ? "text-red-500" : ""}`}>{eur(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td colSpan={5} className="p-3">Total {ano}</td>
                  <td className={`p-3 text-right tabular-nums ${total < 0 ? "text-red-500" : ""}`}>{eur(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
