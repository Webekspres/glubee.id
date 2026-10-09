import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, readJson, success } from "@/lib/api";
import { reminderSettings, validatePushSubscription } from "@/lib/domain/reminder";
import { keyedHash, sealText, toBytea } from "@/lib/secret-box";

// GLB-020 / FR-REMINDER-001: langganan browser push milik pengguna. Kunci publik VAPID dibaca
// saat runtime (bukan NEXT_PUBLIC_*) supaya satu image Docker bisa dipakai staging dan production.

export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  const settings = reminderSettings();
  return success({
    push: settings.push,
    email: settings.enabled,
    publicKey: settings.push ? settings.vapid.publicKey : null,
  });
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (!reminderSettings().push) return failure("PUSH_DISABLED", "Notifikasi browser belum tersedia.", 409);
  if (await rateLimited(auth.supabase, "push.write", 20))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const sub = validatePushSubscription(await readJson(request));
  if (!sub) return failure("VALIDATION_ERROR", "Data langganan notifikasi tidak valid.", 422);
  const { error } = await auth.supabase.rpc("save_push_subscription", {
    p_endpoint_hash: toBytea(keyedHash(sub.endpoint)),
    p_ciphertext: toBytea(sealText(JSON.stringify(sub))),
  });
  if (error)
    return failure(
      "REQUEST_FAILED",
      error.message.includes("too_many")
        ? "Terlalu banyak perangkat. Matikan notifikasi di perangkat lain dulu."
        : "Notifikasi belum dapat diaktifkan.",
      400,
    );
  return success({ active: true }, 201);
}

export async function DELETE(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "push.write", 20))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const body = (await readJson(request)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 2048)
    return failure("VALIDATION_ERROR", "Endpoint tidak valid.", 422);
  const { error } = await auth.supabase.rpc("remove_push_subscription", {
    p_endpoint_hash: toBytea(keyedHash(body.endpoint)),
  });
  return error ? failure("REQUEST_FAILED", "Notifikasi belum dapat dimatikan.", 400) : success({ active: false });
}
