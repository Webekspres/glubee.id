"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ApiError, api, ZONES, type Profile, type Timezone } from "@/lib/ui";
import { PageHeading, ErrorMessage } from "./Ui";
import { TransitionLink as Link } from "./TransitionLink";
import { RangeFilter } from "./RangeFilter";
import { APP_CONFIG } from "@/lib/config";

type Preview =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; count: number; from: string; toExclusive: string };

function rangeText(from: string, toExclusive: string, zone: Timezone) {
  const f = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: ZONES[zone],
  });
  return f.formatRange(new Date(from), new Date(Date.parse(toExclusive) - 1));
}

export function ReportForm({ profile }: { profile: Profile }) {
  const zone = profile.timezone_code ?? "WIB";
  const [query, setQuery] = useState("period=current_month"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [done, setDone] = useState(false),
    [loaded, setLoaded] = useState<{ query: string; preview: Preview }>();

  // Sebelum mengunduh, tunjukkan berapa catatan valid yang akan masuk ke PDF,
  // supaya periode kosong tidak baru ketahuan setelah PDF dibuka.
  useEffect(() => {
    if (!query) return;
    let live = true;
    const set = (preview: Preview) => live && setLoaded({ query, preview });
    api<{ count: number }>("/api/glucose-summary?" + query)
      .then((r) => {
        const range = (r.meta as { range?: { from: string; toExclusive: string } })
          ?.range;
        set(
          range
            ? { state: "ready", count: r.data.count, ...range }
            : { state: "error" },
        );
      })
      .catch(() => set({ state: "error" }));
    return () => {
      live = false;
    };
  }, [query]);
  const preview: Preview =
    loaded?.query === query ? loaded.preview : { state: "loading" };
  const empty = preview.state === "ready" && preview.count === 0;

  async function download() {
    if (busy || !query) return;
    setBusy(true);
    setError(null);
    try {
      // Route menerima POST JSON dan mengembalikan PDF biner, jadi tidak memakai helper `api` (JSON).
      let res: Response;
      try {
        res = await fetch("/api/reports", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            Object.fromEntries(new URLSearchParams(query)),
          ),
        });
      } catch {
        throw new ApiError("Koneksi terputus. Silakan coba lagi.");
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(
          res.status === 401
            ? "Sesi berakhir atau akun belum terverifikasi. Silakan masuk kembali."
            : (body?.error?.message ?? "Laporan belum dapat dibuat. Coba lagi."),
          res.status,
        );
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-glubee-${profile.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "pemantauan"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDone(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow stack">
      <PageHeading
        title="Laporan pemantauan"
        description="Unduh ringkasan, grafik, dan catatan valid dalam satu PDF."
      />
      <section className="panel stack">
        <h2>Pilih periode laporan</h2>
        <RangeFilter
          initial="current_month"
          zone={zone}
          onChange={(q) => {
            setQuery(q);
            setDone(false);
          }}
        />
        <p className="small muted">
          Bulan ini mengikuti tanggal 1 hingga akhir bulan kalender. Semua
          tanggal menggunakan zona {profile.timezone_code}.
        </p>
        {query && (
          <div className="report-preview" aria-live="polite">
            {preview.state === "loading" && (
              <p className="small muted">Menghitung catatan pada periode ini…</p>
            )}
            {preview.state === "error" && (
              <p className="small muted">
                Jumlah catatan belum dapat dihitung. Laporan tetap bisa diunduh.
              </p>
            )}
            {preview.state === "ready" && !empty && (
              <p>
                <strong>{preview.count} catatan valid</strong> akan masuk ke
                laporan, {rangeText(preview.from, preview.toExclusive, zone)}.
              </p>
            )}
            {empty && (
              <p>
                <strong>Belum ada catatan valid</strong> pada{" "}
                {rangeText(preview.from, preview.toExclusive, zone)}. Pilih
                periode lain, atau <Link href="/log">catat hasil pengukuran</Link>{" "}
                dulu.
              </p>
            )}
          </div>
        )}
        <p className="notice">{APP_CONFIG.disclaimer}</p>
        <ErrorMessage error={error} />
        {done && (
          <p className="message success" role="status">
            Laporan berhasil dibuat dan unduhan dimulai.
          </p>
        )}
        <button
          className="button primary"
          disabled={busy || !query || empty}
          onClick={download}
        >
          {busy ? "Menyiapkan PDF…" : "Unduh laporan PDF"}
        </button>
      </section>
      <figure className="report-thumb">
        <Image
          src="/brand/report-sample.webp"
          alt="Contoh halaman pertama laporan PDF: identitas, ringkasan, grafik, dan daftar catatan"
          width={180}
          height={254}
        />
        <figcaption>
          Isi laporan: identitas dan periode, ringkasan rata-rata, terendah dan
          tertinggi, grafik tren, lalu daftar semua catatan valid. Contoh di
          samping dibuat dari data uji.
        </figcaption>
      </figure>
    </div>
  );
}
