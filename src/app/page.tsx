import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";
export default function Home() {
  return (
    <main id="main" className="container">
      <section className="hero">
        <div>
          <p className="eyebrow">Pencatatan sederhana, untuk keseharian Anda</p>
          <h1>
            Setiap catatan,
            <br />
            satu langkah
            <br />
            lebih terarah.
          </h1>
          <p className="muted">
            Simpan hasil pengukuran gula darah, lihat perjalanannya dari waktu
            ke waktu, dan siapkan laporan untuk konsultasi Anda.
          </p>
          <div className="actions">
            <Link className="button primary" href="/register">
              Mulai mencatat — gratis →
            </Link>
            <Link className="button" href="/login">
              Masuk ke akun
            </Link>
          </div>
          <p className="small muted">
            Untuk usia 18+ · Data pribadi · WIB, WITA, WIT
          </p>
        </div>
        <div className="hero-visual" aria-label="Ilustrasi pencatatan">
          <div className="panel stack">
            <div className="section-heading">
              <h3>Perjalanan pencatatan Anda</h3>
              <span className="badge">Ilustrasi</span>
            </div>
            <svg
              viewBox="0 0 400 170"
              role="img"
              aria-label="Ilustrasi grafik, bukan data pengguna"
            >
              <path
                d="M10 40H390 M10 85H390 M10 130H390"
                stroke="#dfe9e6"
                strokeDasharray="4 5"
              />
              <path
                d="M10 110L70 85L130 95L190 55L250 72L310 45L390 62"
                fill="none"
                stroke="#32796b"
                strokeWidth="3"
              />
              {[
                [10, 110],
                [70, 85],
                [130, 95],
                [190, 55],
                [250, 72],
                [310, 45],
                [390, 62],
              ].map(([x, y]) => (
                <circle
                  key={x}
                  cx={x}
                  cy={y}
                  r="5"
                  fill="#16605b"
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
            </svg>
            <div className="notice">
              <strong>Catat. Tinjau. Bawa saat konsultasi.</strong>
              <br />
              Semua hasil pengukuran tersusun dalam satu tempat.
            </div>
          </div>
        </div>
      </section>
      <p className="notice">{APP_CONFIG.disclaimer}</p>
      <section className="feature-grid" aria-label="Fitur Glubee">
        {[
          [
            "01",
            "Pencatatan yang teratur",
            "Simpan nilai, satuan, kondisi, dan waktu pengukuran Anda.",
          ],
          [
            "02",
            "Riwayat yang mudah ditinjau",
            "Lihat grafik dan telusuri catatan. Koreksi tersimpan tanpa menghilangkan riwayat asli.",
          ],
          [
            "03",
            "Laporan siap diunduh",
            "Unduh PDF sesuai periode pilihan untuk dibawa saat berkonsultasi.",
          ],
        ].map(([number, title, copy]) => (
          <article key={number} className="panel">
            <div className="step-number">{number}</div>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
