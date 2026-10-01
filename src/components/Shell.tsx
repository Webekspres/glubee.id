"use client";
import { leavePage, TransitionLink as Link } from "./TransitionLink";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { APP_CONFIG } from "@/lib/config";
import { api } from "@/lib/ui";
import { ErrorMessage } from "./Ui";
import { CookieConsent } from "./CookieConsent";

// Placeholder logo: huruf "b" sebagai lebah menghadap kanan, sayap panjang jadi batang huruf.
function Wordmark() {
  return (
    <span className="wordmark">
      glu
      <svg viewBox="0 0 60 80" aria-hidden="true">
        <ellipse
          cx="17"
          cy="30"
          rx="9"
          ry="27"
          transform="rotate(-8 17 30)"
          fill="#bfe3d4"
          stroke="currentColor"
          strokeWidth="3.5"
        />
        <ellipse
          cx="30"
          cy="36"
          rx="7"
          ry="18"
          transform="rotate(22 30 36)"
          fill="#dff1ea"
          stroke="currentColor"
          strokeWidth="3"
        />
        <ellipse cx="33" cy="57" rx="22" ry="19" fill="currentColor" />
        <path
          d="M22 40c-3 10-3 24 0 34M33 38.5c-2 12-2 25 0 37"
          stroke="#003f66"
          strokeWidth="5.5"
          fill="none"
        />
        <circle cx="46" cy="52" r="3.4" fill="#011b2f" />
        <circle cx="47.2" cy="50.8" r="1.1" fill="#fff" />
        <path
          d="M44 61q4 3 8-1"
          stroke="#011b2f"
          strokeWidth="2.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M48 40q3-9 10-10M42 39q-1-9 4-14"
          stroke="#003f66"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="58" cy="30" r="2.5" fill="#003f66" />
        <circle cx="46" cy="25" r="2.5" fill="#003f66" />
      </svg>
      <span className="sr-only">b</span>
      ee
    </span>
  );
}

const links = [
  ["/dashboard", "Ringkasan"],
  ["/log", "Catat gula darah"],
  ["/history", "Riwayat"],
  ["/reports", "Laporan"],
  ["/profile", "Profil & privasi"],
];

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [prevPath, setPrevPath] = useState(path);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (prevPath !== path) {
    setPrevPath(path);
    setMenu(false);
  }

  const member =
    links.some(([href]) => path === href) ||
    ["/onboarding", "/account-status"].includes(path);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      leavePage(() => {
        router.replace("/login");
        router.refresh();
        setBusy(false);
      });
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  const handleFabClick = (e: React.MouseEvent) => {
    if (path === "/dashboard") {
      e.preventDefault();
      window.dispatchEvent(new Event("open-glucose-modal"));
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      {member && menu && (
        <div
          className="nav-backdrop"
          onClick={() => setMenu(false)}
          aria-hidden="true"
        />
      )}
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href={member ? "/dashboard" : "/"}>
            <Wordmark />
            <span className="preview">Pratinjau</span>
          </Link>
          {member ? (
            <>
              {/* Di mobile navigasi ada di tab bar bawah; header cukup tombol Keluar. */}
              <button
                className="button quiet header-logout"
                onClick={logout}
                disabled={busy}
              >
                {busy ? "Keluar…" : "Keluar"}
              </button>
              <button
                className="button menu-toggle"
                aria-expanded={menu}
                aria-controls="main-nav"
                aria-label={menu ? "Tutup menu navigasi" : "Buka menu navigasi"}
                onClick={() => setMenu(!menu)}
              >
                {menu ? "✕ Tutup" : "☰ Menu"}
              </button>
              <nav
                id="main-nav"
                className={menu ? "nav open" : "nav"}
                aria-label="Navigasi utama"
              >
                {links.map(([href, text]) => (
                  <Link
                    key={href}
                    href={href}
                    aria-current={path === href ? "page" : undefined}
                    onClick={() => setMenu(false)}
                  >
                    {text}
                  </Link>
                ))}
                <button
                  className="button quiet"
                  onClick={logout}
                  disabled={busy}
                >
                  {busy ? "Keluar…" : "Keluar"}
                </button>
              </nav>
            </>
          ) : path.startsWith("/admin-xyz") ? (
            <span className="preview">Admin</span>
          ) : (
            <nav className="public-nav" aria-label="Akun">
              <Link href="/login">Masuk</Link>
              <Link className="button primary" href="/register">
                Buat akun
              </Link>
            </nav>
          )}
        </div>
      </header>
      <div className="container">
        <ErrorMessage error={error} />
      </div>
      {children}
      <footer className="site-footer">
        <div className="container">
          <p>{APP_CONFIG.disclaimer}</p>
          <p className="small">{APP_CONFIG.developerNotice}</p>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Glubee · Versi pengujian</span>
            <nav aria-label="Informasi layanan">
              <Link href="/terms">Syarat & ketentuan</Link>
              <Link href="/privacy">Kebijakan privasi</Link>
              <button
                className="text-button"
                onClick={() =>
                  window.dispatchEvent(new Event("open-cookie-preferences"))
                }
              >
                Pengaturan Cookie
              </button>
            </nav>
          </div>
        </div>
      </footer>

      {member && (
        <nav className="mobile-bottom-bar" aria-label="Navigasi Bawah">
          <Link
            href="/dashboard"
            className={`mobile-tab-item ${path === "/dashboard" ? "active" : ""}`}
            aria-current={path === "/dashboard" ? "page" : undefined}
          >
            <svg
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span>Ringkasan</span>
          </Link>

          <Link
            href="/history"
            className={`mobile-tab-item ${path === "/history" ? "active" : ""}`}
            aria-current={path === "/history" ? "page" : undefined}
          >
            <svg
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Riwayat</span>
          </Link>

          <Link
            href="/log"
            className="mobile-tab-fab"
            aria-label="Catat gula darah baru"
            title="Catat gula darah"
            onClick={handleFabClick}
          >
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </Link>

          <Link
            href="/reports"
            className={`mobile-tab-item ${path === "/reports" ? "active" : ""}`}
            aria-current={path === "/reports" ? "page" : undefined}
          >
            <svg
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>Laporan</span>
          </Link>

          <Link
            href="/profile"
            className={`mobile-tab-item ${path === "/profile" ? "active" : ""}`}
            aria-current={path === "/profile" ? "page" : undefined}
          >
            <svg
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span>Profil</span>
          </Link>
        </nav>
      )}

      <CookieConsent />
    </>
  );
}
