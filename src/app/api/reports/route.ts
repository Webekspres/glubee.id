import { authenticatedRequest } from "@/lib/auth";
import { failure, objectValue, readJson, safeDatabaseFailure } from "@/lib/api";
import { resolveRange } from "@/lib/domain/glucose";
import { createReport } from "@/lib/pdf-report";
import type { Profile } from "@/lib/ui";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  const { data: allowed, error: limitError } = await auth.supabase.rpc(
    "consume_report_rate_limit",
  );
  if (limitError || !allowed)
    return failure(
      "REPORT_UNAVAILABLE",
      "Laporan belum dapat dibuat. Pastikan akun aktif dan coba lagi sesaat lagi.",
      429,
    );
  const body = objectValue(await readJson(request));
  const params = new URLSearchParams();
  for (const key of ["from", "to", "period", "month"])
    if (typeof body?.[key] === "string") params.set(key, body[key]);
  const { data: profile, error: profileError } = await auth.supabase
    .from("profiles")
    .select("name,birth_date,sex,timezone_code,account_status")
    .single();
  if (profileError || !profile?.timezone_code)
    return failure("PROFILE_REQUIRED", "Lengkapi profil dahulu.", 409);
  const range = resolveRange(params, profile.timezone_code);
  if (!range)
    return failure("INVALID_RANGE", "Pilih rentang tanggal yang valid.", 422);
  const { data, error } = await auth.supabase.rpc("get_my_glucose_range", {
    p_from: range.from,
    p_to: range.toExclusive,
  });
  if (error) return safeDatabaseFailure();
  if (data.tooLarge)
    return failure(
      "RANGE_TOO_LARGE",
      "Rentang memuat lebih dari 5.000 catatan. Pilih rentang lebih pendek.",
      422,
    );
  try {
    const bytes = await createReport(profile as Profile, data.entries, range);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="laporan-glubee.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return failure(
      "PDF_FAILED",
      error instanceof Error && error.message === "UNSUPPORTED_REPORT_CHARACTER"
        ? "Terdapat karakter nama/catatan yang belum didukung font PDF. Hubungi pengelola untuk bantuan."
        : "Laporan belum dapat dibuat. Silakan coba lagi.",
      422,
    );
  }
}
