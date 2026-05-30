import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PasswordConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  onClose,
  onConfirmed,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirmed: () => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!password) { toast.error("Introduza a sua password"); return; }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) { toast.error("Sessão inválida"); return; }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error("Password incorrecta"); return; }
      await onConfirmed();
      setPassword("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-lg w-full max-w-sm p-5 space-y-3">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <label className="block text-sm">
          <span className="text-muted-foreground">A sua password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            className="mt-1 w-full border border-input bg-background rounded-md px-3 py-2"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} disabled={loading} className="px-3 py-2 text-sm rounded-md border border-input">Cancelar</button>
          <button onClick={submit} disabled={loading} className="px-3 py-2 text-sm rounded-md bg-danger text-white disabled:opacity-60">
            {loading ? "A confirmar..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
