import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, idempotencyKey, readJson, safeDatabaseFailure, success } from "@/lib/api";
import { validateGlucoseInput } from "@/lib/domain/glucose";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "glucose.replacement", 30)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const key = idempotencyKey(request);
  if (!key) return failure("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key wajib diisi.", 400);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return failure("INVALID_ID", "ID catatan tidak valid.", 400);
  const validated = validateGlucoseInput(await readJson(request));
  if (!validated.data) return failure("VALIDATION_ERROR", "Periksa kembali catatan pengganti.", 422, validated.errors);
  const { data, error } = await auth.supabase.rpc("create_glucose_entry", {
    p_idempotency_key: key,
    p_original_value: validated.data.originalValue,
    p_original_unit: validated.data.originalUnit,
    p_measurement_context: validated.data.measurementContext,
    p_measured_at: validated.data.measuredAt,
    p_note: validated.data.note,
    p_replacement_for_id: id,
  });
  return error ? safeDatabaseFailure("Catatan pengganti belum dapat dibuat.") : success(data, 201);
}
