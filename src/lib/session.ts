// "Ingat saya": tanpa centang, cookie sesi Supabase hilang saat browser ditutup
// (lebih aman di perangkat bersama); dengan centang, bertahan 30 hari dan
// diperpanjang setiap kali token disegarkan.
export const REMEMBER_COOKIE = "glubee_remember";
export const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;

type CookieOptions = { maxAge?: number; expires?: Date; [key: string]: unknown };

export function sessionCookieOptions<T extends CookieOptions>(
  options: T,
  remember: boolean,
  value: string,
): T {
  // Penghapusan cookie (logout) dibiarkan apa adanya.
  if (!value || options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.expires;
  delete rest.maxAge;
  return (remember ? { ...rest, maxAge: REMEMBER_MAX_AGE } : rest) as T;
}
