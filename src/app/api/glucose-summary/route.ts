import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, safeDatabaseFailure, success } from "@/lib/api";
import { glucoseSummary, resolveRange } from "@/lib/domain/glucose";

export async function GET(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "glucose.summary", 120)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const url = new URL(request.url);
  if (!url.searchParams.has("period") && !url.searchParams.has("from")) url.searchParams.set("period", "7");
  const { data: profile } = await auth.supabase.from("profiles").select("timezone_code").single();
  const timezone = profile?.timezone_code as "WIB" | "WITA" | "WIT" | undefined;
  if (!timezone) return failure("PROFILE_REQUIRED", "Lengkapi profil terlebih dahulu.", 409);
  const range = resolveRange(url.searchParams, timezone);
  if (!range) return failure("INVALID_RANGE", "Rentang tanggal tidak valid.", 400);
  const { data, error } = await auth.supabase
    .from("glucose_entries")
    .select("normalized_mg_dl,original_value,original_unit,measurement_context,measured_at")
    .eq("status", "valid")
    .gte("measured_at", range.from)
    .lt("measured_at", range.toExclusive)
    .order("measured_at", { ascending: true });
  return error ? safeDatabaseFailure() : success(glucoseSummary(data ?? []), 200, { range, timezone });
}
