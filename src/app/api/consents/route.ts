import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, safeDatabaseFailure, success } from "@/lib/api";

export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase
    .from("consent_receipts")
    .select("id,consent_type,document_version,decision,recorded_at,method,withdrawn_at")
    .order("recorded_at", { ascending: false });
  return error ? safeDatabaseFailure() : success(data);
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "consents", 20)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const body = objectValue(await readJson(request));
  const consentType = typeof body?.consentType === "string" ? body.consentType : "";
  const decision = typeof body?.decision === "string" ? body.decision : "";
  const method = typeof body?.method === "string" ? body.method : "settings";
  const { data, error } = await auth.supabase.rpc("record_consent", {
    p_type: consentType,
    p_decision: decision,
    p_method: method,
  });
  return error ? safeDatabaseFailure("Persetujuan belum dapat dicatat.") : success(data, 201);
}
