import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, REMEMBER_MAX_AGE, sessionCookieOptions } from "@/lib/session";

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase public environment is not configured");
  return { url, key };
}

const secure = () => process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;

// Simpan pilihan "Ingat saya" agar penyegaran token berikutnya memakai masa
// berlaku yang sama. Dipanggil saat login (email atau Google) dan logout.
export async function setRememberPreference(remember: boolean) {
  const store = await cookies();
  if (remember)
    store.set(REMEMBER_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: secure(),
      path: "/",
      maxAge: REMEMBER_MAX_AGE,
    });
  else store.delete(REMEMBER_COOKIE);
}

export async function createSupabaseServerClient(options?: { remember?: boolean }) {
  const { url, key } = publicConfig();
  const store = await cookies();
  const remember = options?.remember ?? store.get(REMEMBER_COOKIE)?.value === "1";

  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: secure(),
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          store.set(name, value, sessionCookieOptions(options, remember, value));
        }
      },
    },
  });
}
