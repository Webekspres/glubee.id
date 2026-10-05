import { TransitionLink as Link } from "@/components/TransitionLink";
import { Mascot } from "@/components/Mascot";

export default function NotFound() {
  return (
    <main id="main" className="container page">
      <div className="panel stack not-found">
        <Mascot width={130} pose="search" />
        <p className="eyebrow">Galat 404</p>
        <h1>Halaman tidak ditemukan</h1>
        <p>Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.</p>
        <p>
          <Link href="/" className="button primary">
            Kembali ke beranda
          </Link>
        </p>
      </div>
    </main>
  );
}
