import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supabase as supabaseBrowser } from "@/integrations/supabase/client";

const withAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

async function ensureAdminOrGestor(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("gestor")) {
    throw new Error("Apenas administradores ou gestores");
  }
}

export const gerarNotificacoes = createServerFn({ method: "POST" })
  .middleware([withAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin.rpc("gerar_notificacoes");
    if (error) throw new Error(error.message);
    return { inserted: data ?? 0 };
  });

export const snapshotMes = createServerFn({ method: "POST" })
  .middleware([withAuthHeader, requireSupabaseAuth])
  .inputValidator((d) => z.object({
    ano: z.number().int().min(2000).max(2100),
    mes: z.number().int().min(1).max(12),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data: n, error } = await supabaseAdmin.rpc("snapshot_obras_mes", { _ano: data.ano, _mes: data.mes });
    if (error) throw new Error(error.message);
    return { count: n ?? 0 };
  });
