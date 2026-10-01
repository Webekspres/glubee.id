import { adminDatabaseFailure, adminRequest } from "@/lib/admin";
import { rateLimited } from "@/lib/auth";
import { failure, success } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await adminRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "admin.search", 60))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const { data, error } = await auth.supabase.rpc("admin_search_accounts", { p_query: query });
  return error ? adminDatabaseFailure(error) : success(data);
}
