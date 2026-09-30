import { HeroPreview } from "@/components/HeroPreview";
import { Mascot } from "@/components/Mascot";
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
        <div className="hero-visual">
          <Mascot width={150} className="hero-mascot" priority />
          <HeroPreview />
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
