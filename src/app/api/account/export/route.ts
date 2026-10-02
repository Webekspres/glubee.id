import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { exportFileName } from "@/lib/domain/export";
import { authMethod, requireReauth } from "@/lib/reauth";
import type { Timezone } from "@/lib/ui";

// Cara verifikasi yang berlaku untuk akun ini, agar UI tahu perlu password atau tidak.
export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  return success({ method: authMethod(auth.user) });
}

// GLB-023 / FR-EXPORT-001: unduh semua data milik sendiri sebagai JSON setelah
// re-authentication. Tidak ada file yang disimpan di server.
export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "account.export", 5))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi dalam satu menit.", 429);

  const denied = await requireReauth(auth.user, objectValue(await readJson(request)));
  if (denied) return denied;

  const { data, error } = await auth.supabase.rpc("export_my_data");
  if (error)
    return error.message?.includes("export_not_allowed")
      ? failure("EXPORT_NOT_ALLOWED", "Ekspor tidak tersedia untuk status akun ini.", 403)
      : failure("EXPORT_FAILED", "Ekspor belum dapat dibuat. Coba lagi.", 500);

  const zone = ((data as { account?: { timezone?: string } })?.account?.timezone ?? "WIB") as Timezone;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(new Date(), zone)}"`,
      "Cache-Control": "no-store",
    },
  });
}
