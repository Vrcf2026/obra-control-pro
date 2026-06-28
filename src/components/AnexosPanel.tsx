import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Paperclip, Upload, Trash2, FileText, Download } from "lucide-react";

type Entidade = "obra" | "lancamento" | "fatura" | "fornecedor" | "cliente";
interface Anexo {
  id: string;
  entidade: string;
  entidade_id: string;
  nome: string;
  path: string;
  mime: string | null;
  tamanho: number | null;
  uploaded_by: string | null;
  created_at: string;
}

function humanSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function AnexosPanel({ entidade, entidadeId, compact = false }: {
  entidade: Entidade; entidadeId: string; compact?: boolean;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { load(); }, [entidade, entidadeId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("anexos").select("*")
      .eq("entidade", entidade).eq("entidade_id", entidadeId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Anexo[]);
    setLoading(false);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true); setErr(null);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${entidade}/${entidadeId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from("anexos").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("anexos").insert({
          entidade, entidade_id: entidadeId, nome: file.name, path,
          mime: file.type || null, tamanho: file.size, uploaded_by: user.id,
        });
        if (insErr) {
          await supabase.storage.from("anexos").remove([path]);
          throw insErr;
        }
      }
      await load();
    } catch (e: any) {
      setErr(e.message || "Erro no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onDownload(a: Anexo) {
    const { data, error } = await supabase.storage.from("anexos").createSignedUrl(a.path, 60);
    if (error) { alert(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function onDelete(a: Anexo) {
    if (!confirm(`Eliminar "${a.nome}"?`)) return;
    await supabase.storage.from("anexos").remove([a.path]);
    await supabase.from("anexos").delete().eq("id", a.id);
    await load();
  }

  return (
    <div className={compact ? "" : "bg-card border border-border rounded-lg p-4"}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Paperclip className="w-4 h-4" /> Anexos</h3>
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90">
            <Upload className="w-4 h-4" /> {uploading ? "A enviar…" : "Adicionar"}
            <input type="file" multiple className="hidden" onChange={onUpload} disabled={uploading} />
          </label>
        </div>
      )}
      {compact && (
        <label className="cursor-pointer inline-flex items-center gap-2 px-2 py-1 text-xs rounded border border-input hover:bg-muted mb-2">
          <Upload className="w-3 h-3" /> {uploading ? "…" : "Anexar"}
          <input type="file" multiple className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
      )}
      {err && <div className="text-sm text-destructive mb-2">{err}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">A carregar…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">Sem anexos.</div>
      ) : (
        <ul className="space-y-1">
          {items.map(a => (
            <li key={a.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <button onClick={() => onDownload(a)} className="flex-1 text-left truncate hover:underline">{a.nome}</button>
              <span className="text-xs text-muted-foreground tabular-nums">{humanSize(a.tamanho)}</span>
              <button onClick={() => onDownload(a)} className="p-1 text-muted-foreground hover:text-foreground" title="Descarregar">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(a)} className="p-1 text-muted-foreground hover:text-destructive" title="Eliminar">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
