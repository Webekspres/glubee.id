import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, idempotencyKey, objectValue, readJson, safeDatabaseFailure, success } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "glucose.invalidate", 30)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const key = idempotencyKey(request);
  if (!key) return failure("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key wajib diisi.", 400);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return failure("INVALID_ID", "ID catatan tidak valid.", 400);
  const body = objectValue(await readJson(request));
  const reason = typeof body?.reason === "string" ? body.reason : null;
  const { data, error } = await auth.supabase.rpc("invalidate_glucose_entry", {
    p_entry_id: id,
    p_idempotency_key: key,
    p_reason: reason,
  });
  return error ? safeDatabaseFailure("Catatan tidak ditemukan atau sudah ditandai salah.") : success(data);
}
