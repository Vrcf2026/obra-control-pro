import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { gerarNotificacoes } from "@/lib/jobs.functions";

interface Notif {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function load() {
    const { data } = await supabase.from("notificacoes")
      .select("*").order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as Notif[]);
  }

  const naoLidas = items.filter(i => !i.lida).length;

  async function marcarLida(id: string) {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    load();
  }
  async function marcarTodas() {
    await supabase.from("notificacoes").update({ lida: true }).eq("lida", false);
    load();
  }
  async function eliminar(id: string) {
    await supabase.from("notificacoes").delete().eq("id", id);
    load();
  }
  async function gerar() {
    setRunning(true);
    try { await gerarNotificacoes({} as any); await load(); }
    catch (e: any) { alert(e.message); }
    finally { setRunning(false); }
  }

  if (!user) return null;
  const canGenerate = role === "admin" || role === "gestor";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-md hover:bg-sidebar-accent/60"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {naoLidas > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-auto bg-card text-foreground border border-border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between p-2 border-b border-border sticky top-0 bg-card">
            <span className="text-sm font-semibold">Notificações</span>
            <div className="flex gap-1">
              {canGenerate && (
                <button onClick={gerar} disabled={running}
                  className="text-xs px-2 py-1 rounded border border-input hover:bg-muted">
                  {running ? "…" : "Verificar"}
                </button>
              )}
              {naoLidas > 0 && (
                <button onClick={marcarTodas} className="text-xs px-2 py-1 rounded border border-input hover:bg-muted inline-flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" /> Todas
                </button>
              )}
            </div>
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações.</div>
          ) : (
            <ul>
              {items.map(n => (
                <li key={n.id} className={`p-3 border-b border-border text-sm ${n.lida ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {n.link ? (
                        <Link to={n.link} onClick={() => { marcarLida(n.id); setOpen(false); }}
                          className="font-medium hover:underline block truncate">{n.titulo}</Link>
                      ) : (
                        <div className="font-medium truncate">{n.titulo}</div>
                      )}
                      {n.corpo && <div className="text-xs text-muted-foreground mt-0.5">{n.corpo}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-PT")}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!n.lida && (
                        <button onClick={() => marcarLida(n.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Marcar como lida">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => eliminar(n.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
