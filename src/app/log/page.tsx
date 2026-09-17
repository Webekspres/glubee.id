"use client";
import { useState } from "react";
import Link from "next/link";
import { SessionGate } from "@/components/SessionGate";
import { GlucoseEntryForm } from "@/components/GlucoseEntryForm";
import { PageHeading } from "@/components/Ui";
export default function Page() {
  const [saved, setSaved] = useState(false);
  return (
    <main id="main" className="container page">
      <div className="narrow">
        <PageHeading
          eyebrow="Pengukuran baru"
          title="Catat gula darah"
          description="Masukkan hasil yang tertera pada alat ukur Anda."
        />
        <SessionGate>
          {(profile) => (
            <section className="panel">
              {saved ? (
                <div className="stack">
                  <h2 aria-live="polite">Catatan berhasil disimpan</h2>
                  <p>Anda dapat melihatnya di ringkasan dan riwayat.</p>
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
                  onSaved={() => setSaved(true)}
                />
              )}
            </section>
          )}
        </SessionGate>
      </div>
    </main>
  );
}
