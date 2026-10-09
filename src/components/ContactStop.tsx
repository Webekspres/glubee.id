"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/ui";
import { ErrorMessage, Loading } from "./Ui";

// GLB-022 / FR-CONTACT-001: kontak berhenti tanpa akun. Token di fragment URL (tidak masuk log).

type Stop = { status: "valid" | "done"; inviterName: string; contactName: string };

export function ContactStop() {
  const tokenRef = useRef<string | null>(null);
  const [info, setInfo] = useState<Stop | null>(null),
    [stopped, setStopped] = useState(false),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);

  useEffect(() => {
    tokenRef.current ??= window.location.hash.slice(1);
    history.replaceState(null, "", window.location.pathname);
    let ignore = false;
    api<Stop>("/api/contact-stop", { method: "POST", body: JSON.stringify({ token: tokenRef.current }) })
      .then((r) => !ignore && setInfo(r.data))
      .catch((e) => !ignore && setError(e));
    const reload = () => window.location.reload();
    window.addEventListener("hashchange", reload);
    return () => {
      ignore = true;
      window.removeEventListener("hashchange", reload);
    };
  }, []);

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/contact-stop", { method: "POST", body: JSON.stringify({ token: tokenRef.current, confirm: true }) });
      setStopped(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!info && !error) return <Loading label="Memuat" />;

  return (
    <section className="panel auth-card stack">
      <h1>Berhenti menjadi kontak darurat</h1>
      <ErrorMessage error={error} />
      {info && (stopped || info.status === "done") && (
        <p className="message success" role="status">
          Anda bukan lagi kontak darurat {info.inviterName}. Glubee tidak akan mengirim email kepada Anda atas nama pengguna ini.
        </p>
      )}
      {info && !stopped && info.status === "valid" && (
        <>
          <p>
            Halo, {info.contactName}. Anda terdaftar sebagai kontak darurat {info.inviterName}. Jika berhenti, Glubee tidak
            akan mengirim pemberitahuan apa pun kepada Anda dan {info.inviterName} perlu memilih kontak lain.
          </p>
          <div className="invitation-actions">
            <button className="button primary" onClick={stop} disabled={busy}>
              {busy ? "Memproses…" : "Berhenti menjadi kontak darurat"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
