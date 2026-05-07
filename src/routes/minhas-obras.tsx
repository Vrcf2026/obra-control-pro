import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/use-auth";
import { eur, estadoLabel, estadoColor } from "@/lib/format";
import { ChevronRight, Plus, X } from "lucide-react";
import { DespesaPanel } from "@/components/DespesaPanel";

export const Route = createFileRoute("/minhas-obras")({
  component: () => <Protected><Encarregado /></Protected>,
});

interface Obra { id: string; nome: string; cliente: string; estado: string; localizacao: string | null; gasto?: number }
interface Rubrica { id: string; nome: string; origem: string }

const DISMISS_KEY = "obracontrol:install-dismissed";

function Encarregado() {
  const { user } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDespesa, setShowDespesa] = useState(false);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("obra_utilizadores")
        .select("obra_id, obras(id, nome, cliente, estado, localizacao)")
        .eq("user_id", user.id);
      const arr = ((data ?? []) as any[]).map(x => x.obras).filter(Boolean) as Obra[];
      // Totais gastos por obra
      if (arr.length) {
        const ids = arr.map(o => o.id);
        const { data: lan } = await supabase.from("lancamentos").select("obra_id, valor").in("obra_id", ids);
        const tot: Record<string, number> = {};
        (lan ?? []).forEach((l: any) => { tot[l.obra_id] = (tot[l.obra_id] || 0) + Number(l.valor); });
        arr.forEach(o => { o.gasto = tot[o.id] || 0; });
      }
      setObras(arr);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setInstallEvt(e); 
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - dismissed > 30 * 24 * 3600 * 1000) setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismissInstall() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowInstall(false);
  }
  async function doInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    setInstallEvt(null);
    setShowInstall(false);
  }

  async function abrirDespesaRapida() {
    if (!obras.length) return;
    const obra = obras[0];
    const { data: rubs } = await supabase.from("rubricas").select("id,nome").eq("obra_id", obra.id).order("nome");
    const { data: ads } = await supabase.from("adendas").select("id,descricao,adenda_rubricas(id,nome)").eq("obra_id", obra.id);
    const lista: Rubrica[] = [
      ...((rubs ?? []) as any[]).map(r => ({ id: r.id, nome: r.nome, origem: "Orçamento" })),
      ...((ads ?? []) as any[]).flatMap((a: any) =>
        (a.adenda_rubricas ?? []).map((ar: any) => ({ id: ar.id, nome: ar.nome, origem: `Adenda: ${a.descricao}` }))
      ),
    ];
    setRubricas(lista);
    setShowDespesa(true);
  }

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-2xl mx-auto w-full pb-28">
      {showInstall && installEvt && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-sm">
          <span className="flex-1">📲 Instala a app para acesso rápido</span>
          <button onClick={doInstall} className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium">Instalar</button>
          <button onClick={dismissInstall} className="text-muted-foreground hover:text-foreground p-1" aria-label="Dispensar"><X className="w-4 h-4" /></button>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold">As minhas obras</h1>
        <p className="text-sm text-muted-foreground">Toque numa obra para registar despesas</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 Pesquisar obra ou cliente..."
          className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background"
        />
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="">Todos</option>
          {Object.entries(estadoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(q || estado) && (
          <button onClick={() => { setQ(""); setEstado(""); }} className="border border-input rounded-md px-3 py-2 text-sm">Limpar</button>
        )}
      </div>
      {(() => {
        const filtered = obras.filter(o => {
          const m = q.trim().toLowerCase();
          const okQ = !m || o.nome.toLowerCase().includes(m) || (o.cliente || "").toLowerCase().includes(m);
          const okE = !estado || o.estado === estado;
          return okQ && okE;
        });
        return loading ? (
        <div className="p-8 text-center text-muted-foreground">A carregar...</div>
      ) : obras.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">Sem obras atribuídas.</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">Nenhuma obra encontrada.</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(o => (
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">A carregar...</div>
      ) : obras.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">Sem obras atribuídas.</div>
      ) : (
        <ul className="space-y-3">
          {obras.map(o => (
            <li key={o.id}>
              <Link to="/obras/$id" params={{ id: o.id }}
                className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-colors active:scale-[0.99]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-base truncate">{o.nome}</div>
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {o.cliente}{o.localizacao ? ` · ${o.localizacao}` : ""}
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className={`inline-block text-xs px-2 py-1 rounded-md font-medium ${estadoColor[o.estado]}`}>
                        {estadoLabel[o.estado]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Gasto: <span className="font-medium text-foreground tabular-nums">{eur(o.gasto || 0)}</span>
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {obras.length > 0 && (
        <button onClick={abrirDespesaRapida}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-4 inline-flex items-center gap-2 font-medium active:scale-95 transition-transform"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
          <Plus className="w-5 h-5" /> Despesa rápida
        </button>
      )}

      {showDespesa && obras[0] && (
        <DespesaPanel obraId={obras[0].id} rubricas={rubricas}
          onClose={() => setShowDespesa(false)}
          onSaved={() => setShowDespesa(false)} />
      )}
    </div>
  );
}
