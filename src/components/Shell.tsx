"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { APP_CONFIG } from "@/lib/config";
import { api } from "@/lib/ui";
import { ErrorMessage } from "./Ui";
import { CookieConsent } from "./CookieConsent";

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
      router.replace("/login");
      router.refresh();
      setBusy(false);
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
            <span className="brand-symbol" aria-hidden="true">
              g
            </span>
            glubee<span className="preview">Pratinjau</span>
          </Link>
          {member ? (
            <>
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
