import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Protected } from "@/components/Protected";
import { estadoLabel, estadoColor } from "@/lib/format";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/encarregado")({
  component: () => <Protected><Encarregado /></Protected>,
});

interface Obra { id: string; nome: string; cliente: string; estado: string; localizacao: string | null }

function Encarregado() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("obras").select("id,nome,cliente,estado,localizacao")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setObras((data ?? []) as Obra[]); setLoading(false); });
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">As minhas obras</h1>
        <p className="text-sm text-muted-foreground">Toque numa obra para registar lançamentos</p>
      </div>
      {loading ? (
        <div className="p-8 text-center text-muted-foreground">A carregar...</div>
      ) : obras.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-card border border-border rounded-lg">Sem obras atribuídas.</div>
      ) : (
        <ul className="space-y-2">
          {obras.map(o => (
            <li key={o.id}>
              <Link to="/obras/$id" params={{ id: o.id }}
                className="block bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.nome}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {o.cliente}{o.localizacao ? ` · ${o.localizacao}` : ""}
                    </div>
                    <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-md font-medium ${estadoColor[o.estado]}`}>
                      {estadoLabel[o.estado]}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
