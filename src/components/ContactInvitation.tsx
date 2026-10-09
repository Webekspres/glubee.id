"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/ui";
import { CONTACT_ALERTS_PENDING, contactAcceptText } from "@/lib/notices";
import { ErrorMessage, Loading } from "./Ui";
import { Mascot } from "./Mascot";

// GLB-021 / FR-CONTACT-001, CNT-CONTACT-ACCEPT-001: halaman undangan untuk kontak tanpa akun.
// Token dibaca dari fragment URL (#…) agar tidak pernah sampai ke log server.

type Invitation = {
  status: "valid" | "used" | "expired";
  inviterName: string;
  contactName: string;
  noticeVersion: string;
};

export function ContactInvitation() {
  const [token, setToken] = useState<string | null>(null),
    [invitation, setInvitation] = useState<Invitation | null>(null),
    [result, setResult] = useState<"active" | "declined" | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);

  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Baca sekali (effect bisa berjalan dua kali), lalu hapus dari bilah alamat dan riwayat.
    tokenRef.current ??= window.location.hash.slice(1);
    const t = tokenRef.current;
    history.replaceState(null, "", window.location.pathname);
    let ignore = false;
    queueMicrotask(() => setToken(t));
    api<Invitation>("/api/contact-invitations", { method: "POST", body: JSON.stringify({ token: t }) })
      .then((r) => !ignore && setInvitation(r.data))
      .catch((e) => !ignore && setError(e));
    // Tautan undangan lain dibuka di tab yang sama: hanya hash yang berubah, muat ulang.
    const reload = () => window.location.reload();
    window.addEventListener("hashchange", reload);
    return () => {
      ignore = true;
      window.removeEventListener("hashchange", reload);
    };
  }, []);

  async function decide(decision: "accept" | "decline") {
    if (!invitation || !token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ state: "active" | "declined" }>("/api/contact-invitations", {
        method: "POST",
        body: JSON.stringify({ token, decision, noticeVersion: invitation.noticeVersion }),
      });
      setResult(r.data.state);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!invitation && !error) return <Loading label="Memuat undangan" />;

  return (
    <section className="panel auth-card stack invitation">
      <h1>Undangan kontak darurat</h1>
      <ErrorMessage error={error} />
      {invitation && result && (
        <p className="message success" role="status">
          {result === "active"
            ? `Terima kasih. Anda kini kontak darurat ${invitation.inviterName}. Anda dapat berhenti kapan saja melalui tautan pada email dari Glubee.`
            : `Undangan ditolak. ${invitation.inviterName} tidak dapat mengundang email ini lagi.`}
        </p>
      )}
      {invitation && !result && invitation.status !== "valid" && (
        <p className="message">
          {invitation.status === "used"
            ? "Undangan ini sudah dijawab."
            : "Undangan ini sudah tidak berlaku. Minta pengundang mengirim undangan baru bila diperlukan."}
        </p>
      )}
      {invitation && !result && invitation.status === "valid" && (
        <>
          <p>Halo, {invitation.contactName}.</p>
          <p>{contactAcceptText(invitation.inviterName)}</p>
          <p className="notice small">{CONTACT_ALERTS_PENDING}</p>
          <p className="small muted">
            Pengelola: Glubee. Pertanyaan atau privasi: <a href="mailto:glubeebuddy@gmail.com">glubeebuddy@gmail.com</a> ·{" "}
            <a href="/privacy" target="_blank">
              Kebijakan Privasi
            </a>
          </p>
          <div className="invitation-actions">
            <button className="button primary" onClick={() => decide("accept")} disabled={busy}>
              Terima undangan
            </button>
            <button className="button" onClick={() => decide("decline")} disabled={busy}>
              Tolak
            </button>
          </div>
        </>
      )}
      <Mascot width={120} pose="wave" />
    </section>
  );
}
