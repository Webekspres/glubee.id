import "server-only";

import { failure } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function authenticatedRequest() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      response: failure("AUTH_REQUIRED", "Silakan masuk untuk melanjutkan.", 401),
      supabase: null,
      user: null,
    } as const;
  }

  return { response: null, supabase, user: data.user } as const;
}

export async function rateLimited(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  route: string,
  limit = 60,
) {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_route: route,
    p_limit: limit,
    p_window_seconds: 60,
  });
  return Boolean(error || data !== true);
}
