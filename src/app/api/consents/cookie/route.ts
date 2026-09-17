import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/lib/config";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const COOKIE = "glubee_privacy";
function sign(value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server configuration unavailable");
  return createHmac("sha256", secret)
    .update("cookie-consent:" + value)
    .digest("hex");
}
async function existing() {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return null;
  const [subject, receipt, version, signature] = value.split("~");
  if (
    !subject ||
    !receipt ||
    version !== APP_CONFIG.cookieNoticeVersion ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return null;
  const payload = [subject, receipt, version].join("~");
  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(sign(payload), "hex"),
  )
    ? { subject, receipt }
    : null;
}
export async function GET() {
  return success({
    current: Boolean(await existing()),
    version: APP_CONFIG.cookieNoticeVersion,
  });
}
export async function POST(request: Request) {
  const body = objectValue(await readJson(request)),
    preferences = objectValue(body?.preferences);
  if (
    !preferences ||
    preferences.essential !== true ||
    preferences.analytics !== false ||
    preferences.marketing !== false ||
    !["accept_all", "reject", "preferences", "withdraw"].includes(
      String(body?.decisionSource),
    )
  )
    return failure(
      "INVALID_PREFERENCES",
      "Hanya cookie esensial yang tersedia saat ini.",
      422,
    );
  const previous = await existing();
  const subject = previous?.subject ?? crypto.randomUUID();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("record_cookie_preference", {
    p_subject: subject,
    p_source: body!.decisionSource,
  });
  if (error)
    return failure(
      "COOKIE_SAVE_FAILED",
      "Pilihan belum tersimpan. Silakan coba lagi sesaat lagi.",
      429,
    );
  const value = [subject, data.id, APP_CONFIG.cookieNoticeVersion].join("~");
  (await cookies()).set(COOKIE, value + "~" + sign(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
  });
  return success({ preferences, version: APP_CONFIG.cookieNoticeVersion });
}
