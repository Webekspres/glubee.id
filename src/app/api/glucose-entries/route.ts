import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, idempotencyKey, readJson, safeDatabaseFailure, success } from "@/lib/api";
import { decodeCursor, encodeCursor, resolveRange, validateGlucoseInput } from "@/lib/domain/glucose";

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "glucose.create", 30)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const key = idempotencyKey(request);
  if (!key) return failure("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key wajib diisi.", 400);
  const validated = validateGlucoseInput(await readJson(request));
  if (!validated.data) return failure("VALIDATION_ERROR", "Periksa kembali catatan.", 422, validated.errors);
  const { data, error } = await auth.supabase.rpc("create_glucose_entry", {
    p_idempotency_key: key,
    p_original_value: validated.data.originalValue,
    p_original_unit: validated.data.originalUnit,
    p_measurement_context: validated.data.measurementContext,
    p_measured_at: validated.data.measuredAt,
    p_note: validated.data.note,
  });
  return error ? safeDatabaseFailure("Catatan belum dapat disimpan.") : success(data, 201);
}

export async function GET(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "glucose.history", 120)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const url = new URL(request.url);
  const cursorParam = url.searchParams.get("cursor");
  const cursor = decodeCursor(cursorParam);
  if (cursorParam && !cursor) return failure("INVALID_CURSOR", "Cursor tidak valid.", 400);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
  const { data: profile } = await auth.supabase.from("profiles").select("timezone_code").single();
  const timezone = profile?.timezone_code as "WIB" | "WITA" | "WIT" | undefined;

  let query = auth.supabase
    .from("glucose_entries")
    .select("id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at,recorded_at,note,status,invalidated_at,invalidation_reason,replacement_for_id")
    .order("measured_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (url.searchParams.has("period") || url.searchParams.has("from") || url.searchParams.has("to")) {
    if (!timezone) return failure("PROFILE_REQUIRED", "Lengkapi profil terlebih dahulu.", 409);
    const range = resolveRange(url.searchParams, timezone);
    if (!range) return failure("INVALID_RANGE", "Rentang tanggal tidak valid.", 400);
    query = query.gte("measured_at", range.from).lt("measured_at", range.toExclusive);
  }
  if (cursor) {
    query = query.or(`measured_at.lt.${cursor.measuredAt},and(measured_at.eq.${cursor.measuredAt},id.lt.${cursor.id})`);
  }
  const { data, error } = await query;
  if (error) return safeDatabaseFailure();
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return success(page, 200, {
    nextCursor: hasMore && last ? encodeCursor(last.measured_at, last.id) : null,
  });
}
