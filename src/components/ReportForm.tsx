"use client";
import { useState } from "react";
import { ApiError, type Profile } from "@/lib/ui";
import { PageHeading, ErrorMessage } from "./Ui";
import { RangeFilter } from "./RangeFilter";
import { APP_CONFIG } from "@/lib/config";

export function ReportForm({ profile }: { profile: Profile }) {
  const [query, setQuery] = useState("period=current_month"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [done, setDone] = useState(false);

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
        eyebrow="Siap dibawa saat konsultasi"
        title="Laporan pemantauan"
        description="Unduh ringkasan, grafik, dan catatan valid dalam satu PDF."
      />
      <section className="panel stack">
        <h2>Pilih periode laporan</h2>
        <RangeFilter
          initial="current_month"
          zone={profile.timezone_code ?? "WIB"}
          onChange={(q) => {
            setQuery(q);
            setDone(false);
          }}
        />
        <p className="small muted">
          Bulan ini mengikuti tanggal 1 hingga akhir bulan kalender. Semua
          tanggal menggunakan zona {profile.timezone_code}.
        </p>
        <p className="notice">{APP_CONFIG.disclaimer}</p>
        <ErrorMessage error={error} />
        {done && (
          <p className="message success" role="status">
            Laporan berhasil dibuat dan unduhan dimulai.
          </p>
        )}
        <button
          className="button primary"
          disabled={busy || !query}
          onClick={download}
        >
          {busy ? "Menyiapkan PDF…" : "Unduh laporan PDF"}
        </button>
      </section>
    </div>
  );
}
