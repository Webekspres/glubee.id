import { adminDatabaseFailure, adminRequest } from "@/lib/admin";
import { success } from "@/lib/api";

// BR-RULE-011: admin diberi tahu permintaan penghapusan, tanpa hak menunda/membatalkan.
export async function GET() {
  const auth = await adminRequest();
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase.rpc("admin_deletion_requests");
  return error ? adminDatabaseFailure(error) : success(data);
}
