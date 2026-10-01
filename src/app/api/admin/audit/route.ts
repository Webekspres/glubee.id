import { adminDatabaseFailure, adminRequest } from "@/lib/admin";
import { success } from "@/lib/api";

export async function GET() {
  const auth = await adminRequest();
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.rpc("admin_recent_audit");
  return error ? adminDatabaseFailure(error) : success(data);
}
