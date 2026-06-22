import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as supabaseBrowser } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const withAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabaseBrowser.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});

/**
 * Re-verifies the current user's password without touching their active session.
 * Uses an ephemeral Supabase client (no session persistence) so the user's
 * browser session is not re-emitted and no SIGNED_IN event fires.
 */
export const verifyMyPassword = createServerFn({ method: "POST" })
  .middleware([withAuthHeader, requireSupabaseAuth])
  .inputValidator((data: { password: string }) => {
    if (!data || typeof data.password !== "string" || data.password.length === 0 || data.password.length > 200) {
      throw new Error("Password inválida");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    if (!email) throw new Error("Sessão sem email");

    const ephemeral = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await ephemeral.auth.signInWithPassword({ email, password: data.password });
    if (error) throw new Error("Password incorrecta");
    return { ok: true };
  });
