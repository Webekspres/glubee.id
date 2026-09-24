"use client";
import Link from "next/link";
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { APP_CONFIG } from "@/lib/config";
import { accountDestination, api } from "@/lib/ui";
import { ConsentFields, consentFields } from "./ConsentFields";
import { ErrorMessage } from "./Ui";

type Mode =
  | "login"
  | "register"
  | "reset-password"
  | "update-password"
  | "resend";

const titles: Record<Mode, string> = {
  login: "Selamat datang kembali",
  register: "Mulai mencatat dengan lebih teratur",
  "reset-password": "Pulihkan akses akun",
  "update-password": "Buat password baru",
  resend: "Verifikasi email Anda",
};

const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const params = new URLSearchParams(search);
  const queryError = params.has("authError")
    ? new Error(
        params.get("authError") === "google_unavailable"
          ? "Login Google belum tersedia. Gunakan email dan password."
          : "Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru dan buka pada browser yang sama.",
      )
    : null;

  const fieldId = useId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [message, setMessage] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [showPassword, setShowPassword] = useState(false),
    [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const queryEmail = params.get("email");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(f);
    for (const [name] of consentFields) body[name] = f.get(name) === "on";
    try {
      if (
        (mode === "register" || mode === "update-password") &&
        body.password !== body.passwordConfirmation
      )
        throw new Error("Konfirmasi password tidak sama.");
      const result = await api<{ accountStatus?: string; message?: string }>(
        "/api/auth/" + mode,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (mode === "login")
        router.replace(accountDestination(result.data.accountStatus ?? null));
      else if (mode === "register") {
        const registeredEmail =
          typeof body.email === "string" ? body.email.trim() : "";
        router.replace(
          registeredEmail
            ? "/auth/verify?email=" + encodeURIComponent(registeredEmail)
            : "/auth/verify",
        );
      } else if (mode === "update-password") {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
        router.replace("/login?updated=1");
      } else {
        setMessage(result.data.message ?? "Permintaan telah diproses.");
        setCooldown(60);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="auth-layout">
      <section className="auth-intro">
        <p className="eyebrow">Ruang pribadi untuk catatan Anda</p>
        <h1>{titles[mode]}</h1>
        <p className="muted">
          {mode === "resend"
            ? "Tautan verifikasi digunakan untuk memastikan keamanan akun Anda sebelum mulai mencatat gula darah."
            : "Simpan hasil pengukuran, pahami perjalanan pencatatan Anda, dan siapkan laporan untuk konsultasi."}
        </p>
        <p className="notice">{APP_CONFIG.disclaimer}</p>
      </section>
      <section className="panel auth-card">
        <h2>
          {mode === "login"
            ? "Masuk ke akun"
            : mode === "register"
              ? "Buat akun gratis"
              : mode === "resend"
                ? "Konfirmasi email pendaftaran"
                : "Pemulihan password"}
        </h2>
        <form className="form" onSubmit={submit}>
          <ErrorMessage error={error ?? queryError} />
          {mode === "resend" && queryEmail && (
            <div className="verify-banner">
              <div className="verify-icon" aria-hidden="true">
                ✉️
              </div>
              <div>
                <p className="small">Tautan konfirmasi telah dikirim ke:</p>
                <strong>{queryEmail}</strong>
                <p className="small muted">
                  Buka email tersebut di browser ini untuk mengaktifkan akun Anda.
                </p>
              </div>
            </div>
          )}
          {params.has("expired") && (
            <p className="notice">Silakan masuk untuk melanjutkan.</p>
          )}
          {params.has("updated") && (
            <p className="message success">
              Password diperbarui. Silakan masuk kembali.
            </p>
          )}
          {message && (
            <p role="status" className="message success">
              {message}
            </p>
          )}
          {mode !== "update-password" && (
            <label className="field">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                defaultValue={mode === "resend" && queryEmail ? queryEmail : ""}
              />
              {mode === "resend" && (
                <small>
                  {queryEmail
                    ? "Tekan tombol di bawah jika email konfirmasi belum masuk setelah beberapa saat."
                    : "Masukkan email yang Anda gunakan saat mendaftar untuk meminta tautan baru."}
                </small>
              )}
            </label>
          )}
          {["login", "register", "update-password"].includes(mode) && (
            <div className="field">
              {/* Tombol lihat berada di luar <label> agar nama aksesibel input tetap "Password". */}
              <label htmlFor={`${fieldId}-password`}>Password</label>
              <div className="input-group">
                <input
                  id={`${fieldId}-password`}
                  aria-describedby={`${fieldId}-password-hint`}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="button-toggle-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
              <small id={`${fieldId}-password-hint`}>Minimal 8 karakter.</small>
            </div>
          )}
          {["register", "update-password"].includes(mode) && (
            <div className="field">
              <label htmlFor={`${fieldId}-password-confirmation`}>
                Konfirmasi password
              </label>
              <div className="input-group">
                <input
                  id={`${fieldId}-password-confirmation`}
                  name="passwordConfirmation"
                  type={showPasswordConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="button-toggle-visibility"
                  onClick={() =>
                    setShowPasswordConfirmation(!showPasswordConfirmation)
                  }
                  aria-label={
                    showPasswordConfirmation
                      ? "Sembunyikan konfirmasi password"
                      : "Lihat konfirmasi password"
                  }
                >
                  {showPasswordConfirmation ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
            </div>
          )}
          {mode === "register" && (
            <>
              <label className="field">
                Tanggal lahir
                <input
                  type="date"
                  name="birthDate"
                  autoComplete="bday"
                  required
                />
                <small>Layanan untuk usia 18 tahun ke atas.</small>
              </label>
              <ConsentFields />
            </>
          )}
          {mode === "login" && (
            <Link href="/reset-password" className="small">
              Lupa password?
            </Link>
          )}
          <button
            className="button primary"
            disabled={busy || (mode === "resend" && cooldown > 0)}
          >
            {busy
              ? "Memproses…"
              : mode === "login"
                ? "Masuk"
                : mode === "register"
                  ? "Daftar akun"
                  : mode === "update-password"
                    ? "Simpan password baru"
                    : mode === "reset-password"
                      ? "Kirim tautan"
                      : cooldown > 0
                      ? `Kirim ulang (${cooldown}s)`
                      : "Kirim ulang tautan verifikasi"}
          </button>
          {["login", "register"].includes(mode) && (
            <>
              <div className="divider">atau</div>
              <a className="button" href="/api/auth/google">
                Lanjutkan dengan Google
              </a>
            </>
          )}
          <p className="small muted">
            {mode === "login" ? (
              <>
                <Link href="/register">Belum punya akun? Daftar</Link>
                <br />
                <Link href="/auth/verify">Kirim ulang email verifikasi</Link>
              </>
            ) : mode === "resend" ? (
              <>
                <Link href="/register">Salah memasukkan email? Daftar kembali</Link>
                <br />
                <Link href="/login">Sudah verifikasi? Masuk ke akun</Link>
              </>
            ) : (
              <Link href="/login">Kembali ke halaman masuk</Link>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}
