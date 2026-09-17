"use client";
import { useState } from "react";
import { api, type Profile } from "@/lib/ui";
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
      const res = await api<void>("/api/reports?" + query);
      const url = URL.createObjectURL(
        new Blob([res as unknown as BlobPart], { type: "application/pdf" }),
      );
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
