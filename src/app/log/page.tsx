"use client";
import { useState } from "react";
import { Mascot } from "@/components/Mascot";
import { api, localInput, type Timezone } from "@/lib/ui";
import { TransitionLink as Link } from "@/components/TransitionLink";
import { SessionGate } from "@/components/SessionGate";
import { GlucoseEntryForm } from "@/components/GlucoseEntryForm";
import { PageHeading } from "@/components/Ui";
export default function Page() {
  const [saved, setSaved] = useState(false),
    [first, setFirst] = useState(false);

  // Maskot bersorak hanya untuk catatan pertama: merayakan kebiasaan mencatat,
  // bukan nilai. Di catatan berikutnya angka bisa tinggi, jadi layar tetap tenang.
  async function onSaved(zone: Timezone) {
    setSaved(true);
    setFirst(false);
    // Form lebih panjang dari layar sukses; tanpa ini layar sukses terlihat terpotong di ponsel.
    window.scrollTo({ top: 0 });
    try {
      const to = localInput(new Date(), zone).slice(0, 10);
      const r = await api<unknown[]>(
        `/api/glucose-entries?from=2000-01-01&to=${to}&limit=1`,
      );
      setFirst(r.data.length === 1 && !r.meta?.nextCursor);
    } catch {
      // Tanpa maskot bila pengecekan gagal; catatan sudah tersimpan.
    }
  }
  return (
    <main id="main" className="container page">
      <div className="narrow">
        <PageHeading
          title="Catat gula darah"
          description="Masukkan hasil yang tertera pada alat ukur Anda."
        />
        <SessionGate>
          {(profile) => (
            <section className="panel">
              {saved ? (
                <div className="stack saved-state">
                  {first && <Mascot width={130} pose="cheer" />}
                  <h2 aria-live="polite">
                    {first ? "Catatan pertama tersimpan" : "Catatan berhasil disimpan"}
                  </h2>
                  <p>
                    {first
                      ? "Langkah pertama sudah dimulai. Anda dapat melihatnya di ringkasan dan riwayat."
                      : "Anda dapat melihatnya di ringkasan dan riwayat."}
                  </p>
                  <div className="actions">
                    <Link className="button primary" href="/dashboard">
                      Lihat ringkasan
                    </Link>
                    <button className="button" onClick={() => setSaved(false)}>
                      Catat lagi
                    </button>
                  </div>
                </div>
              ) : (
                <GlucoseEntryForm
                  zone={profile.timezone_code!}
                  onSaved={() => onSaved(profile.timezone_code!)}
                />
              )}
            </section>
          )}
        </SessionGate>
      </div>
    </main>
  );
}
