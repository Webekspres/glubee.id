import Image from "next/image";
import Link from "next/link";
import { HeroPreview } from "@/components/HeroPreview";
import { HexIcon } from "@/components/Icons";
import { Mascot } from "@/components/Mascot";
import { APP_CONFIG } from "@/lib/config";

// Setiap bagian menjawab satu keraguan nyata calon pengguna dan memakai komposisi
// sendiri (RHYTHM 2), bukan grid kartu seragam.
export default function Home() {
  return (
    <main id="main">
      <div className="container">
        <section className="hero">
          <div>
            <h1>
              Setiap catatan,
              <br />
              satu langkah
              <br />
              lebih terarah.
            </h1>
            <p className="hero-lead">
              Simpan hasil pengukuran gula darah, lihat perjalanannya dari waktu
              ke waktu, dan siapkan laporan untuk konsultasi Anda.
            </p>
            <div className="actions">
              <Link className="button primary" href="/register">
                Mulai mencatat gratis
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
      </div>

      <section className="story story-units" aria-labelledby="units-title">
        <div className="container story-grid">
          <div className="story-copy">
            <h2 id="units-title">Ketik angka persis seperti di layar alat Anda</h2>
            <p>
              Glukometer Anda menampilkan mg/dL atau mmol/L? Masukkan apa
              adanya. Glubee menyimpan angka asli dan menampilkan padanannya
              dalam mg/dL, sehingga grafik dan laporan memakai satu satuan.
            </p>
          </div>
          <figure className="unit-demo">
            <div className="unit-value">
              <strong>5,5</strong>
              <span>mmol/L</span>
            </div>
            <span className="unit-equals" aria-hidden="true" />
            <div className="unit-value is-result">
              <strong>99</strong>
              <span>mg/dL</span>
            </div>
            <figcaption>Contoh: 5,5 mmol/L disimpan sebagai 99 mg/dL.</figcaption>
          </figure>
        </div>
      </section>

      <section className="container story-split" aria-labelledby="fix-title">
        <div className="fix-demo" aria-hidden="true">
          <div className="fix-row is-wrong">
            <HexIcon name="random" />
            <span>
              <strong>5,5 mmol/L</strong>
              <small>Sewaktu · Ditandai salah: salah salin angka</small>
            </span>
          </div>
          <div className="fix-row">
            <HexIcon name="random" />
            <span>
              <strong>6 mmol/L</strong>
              <small>Sewaktu · Pengganti catatan sebelumnya</small>
            </span>
          </div>
        </div>
        <div className="story-copy">
          <h2 id="fix-title">Salah ketik tidak menghapus apa pun</h2>
          <p>
            Tandai catatan yang keliru, lalu simpan penggantinya. Catatan lama
            tetap ada di riwayat pribadi Anda, tetapi tidak lagi dihitung di
            grafik, ringkasan, dan laporan.
          </p>
        </div>
      </section>

      <section className="container zone-strip" aria-labelledby="zone-title">
        <h2 id="zone-title">Jam catatan mengikuti tempat Anda tinggal</h2>
        <ul>
          <li>
            <strong>WIB</strong> Sumatra, Jawa, Kalimantan Barat dan Tengah
          </li>
          <li>
            <strong>WITA</strong> Bali, Nusa Tenggara, Sulawesi, Kalimantan
            Selatan, Timur, dan Utara
          </li>
          <li>
            <strong>WIT</strong> Maluku dan Papua
          </li>
        </ul>
        <p className="muted">
          Pilih zona waktu di profil. Pengukuran pukul 06.45 di Makassar
          tercatat 06.45 WITA.
        </p>
      </section>

      <section className="container story-split is-report" aria-labelledby="report-title">
        <div className="story-copy">
          <h2 id="report-title">Laporan untuk dibawa ke dokter</h2>
          <p>
            Pilih 7 hari, 30 hari, bulan ini, atau rentang tanggal sendiri.
            Glubee menyusun ringkasan, grafik, dan daftar catatan valid dalam
            satu PDF yang bisa Anda cetak atau tunjukkan dari ponsel.
          </p>
        </div>
        <figure className="report-shot">
          <Image
            src="/brand/report-sample.webp"
            alt="Halaman pertama contoh laporan PDF Glubee berisi ringkasan dan grafik"
            width={420}
            height={594}
          />
          <figcaption>Halaman pertama laporan, dibuat dari data uji.</figcaption>
        </figure>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <div className="container closing-inner">
          <Mascot width={120} />
          <div>
            <h2 id="closing-title">Mulai dari catatan hari ini</h2>
            <p>{APP_CONFIG.disclaimer}</p>
          </div>
          <Link className="button primary" href="/register">
            Buat akun gratis
          </Link>
        </div>
      </section>
    </main>
  );
}
