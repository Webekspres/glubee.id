import { authenticatedRequest } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  const body = objectValue(await readJson(request));
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) return failure("VALIDATION_ERROR", "Password minimal delapan karakter.", 422);
  const { error } = await auth.supabase.auth.updateUser({ password });
  return error ? failure("PASSWORD_UPDATE_FAILED", "Password belum dapat diperbarui.", 400) : success({ updated: true });
}
