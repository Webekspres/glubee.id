import { adminDatabaseFailure, adminRequest } from "@/lib/admin";
import { rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await adminRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "admin.status", 30))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return failure("INVALID_ID", "ID akun tidak valid.", 400);
  const body = objectValue(await readJson(request));
  const status = body?.status === "suspended" || body?.status === "active" ? body.status : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (!status) return failure("VALIDATION_ERROR", "Status tujuan tidak valid.", 422);
  const { data, error } = await auth.supabase.rpc("admin_set_account_status", {
    p_user_id: id,
    p_status: status,
    p_reason: reason,
    p_correlation_id: crypto.randomUUID(),
  });
  return error ? adminDatabaseFailure(error) : success({ accountStatus: data });
}
