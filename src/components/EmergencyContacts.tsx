"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { api, type Timezone } from "@/lib/ui";
import { CONTACT_ALERTS_PENDING, CONTACT_SHARE_TEXT } from "@/lib/notices";
import { ErrorMessage, Modal, useFieldErrors } from "./Ui";

// GLB-021 / FR-CONTACT-001: maksimal dua kontak darurat; kontak menerima/menolak lewat email
// tanpa akun. Kontak tidak pernah melihat catatan pengguna.

type Contact = {
  id: string;
  name: string;
  email: string;
  state: "pending" | "active" | "declined" | "expired";
  invitationExpiresAt: string | null;
};

const STATE_LABEL: Record<Contact["state"], string> = {
  pending: "Menunggu jawaban",
  active: "Menerima",
  declined: "Menolak",
  expired: "Undangan kedaluwarsa",
};

const ZONES: Record<Timezone, string> = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura" };

export function EmergencyContacts({ zone }: { zone: Timezone }) {
  const [view, setView] = useState<{ items: Contact[]; enabled: boolean; shareConsented: boolean } | null>(null),
    [error, setError] = useState<unknown>(null),
    [inviting, setInviting] = useState(false),
    [busy, setBusy] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch("/api/emergency-contacts", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Kontak darurat belum dapat dimuat.");
        if (!ignore) setView({ items: body.data, enabled: body.meta.enabled, shareConsented: body.meta.shareConsented });
      })
      .catch((e) => !ignore && setError(e));
    return () => {
      ignore = true;
    };
  }, [revision]);

  async function resend(c: Contact) {
    setBusy(c.id);
    setError(null);
    setMessage("");
    try {
      await api(`/api/emergency-contacts/${c.id}/invitation`, { method: "POST", body: "{}" });
      setMessage(`Undangan baru dikirim ke ${c.email}.`);
      setRevision((r) => r + 1);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const expires = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: ZONES[zone] })
      .format(new Date(iso))
      .replace(":", ".");
  const slots = view ? view.items.filter((c) => c.state === "pending" || c.state === "active").length : 0;

  return (
    <section className="panel stack" aria-labelledby="contacts-title">
      <div>
        <h2 id="contacts-title">Kontak darurat</h2>
        <p className="small muted">
          Maksimal dua orang. Mereka menerima atau menolak lewat email, tanpa akun, dan tidak dapat melihat catatan Anda.
        </p>
      </div>
      <p className="notice small">{CONTACT_ALERTS_PENDING}</p>
      <ErrorMessage error={error} />
      {message && (
        <p className="message success" role="status">
          {message}
        </p>
      )}
      {view && view.items.length > 0 && (
        <ul className="contact-list">
          {view.items.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <span className="small muted">{c.email}</span>
              </div>
              <div className="contact-state">
                <span className={`badge state-${c.state}`}>{STATE_LABEL[c.state]}</span>
                {c.state === "pending" && c.invitationExpiresAt && (
                  <span className="small muted">Berlaku sampai {expires(c.invitationExpiresAt)} {zone}</span>
                )}
                {view.enabled && (c.state === "pending" || c.state === "expired") && (
                  <button className="text-button" onClick={() => resend(c)} disabled={busy === c.id}>
                    {busy === c.id ? "Mengirim…" : "Kirim ulang undangan"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {view && view.items.length === 0 && <p className="small muted">Belum ada kontak darurat.</p>}
      {view &&
        (view.enabled ? (
          slots < 2 && (
            <button className="button" onClick={() => setInviting(true)}>
              + Undang kontak darurat
            </button>
          )
        ) : (
          <p className="small muted">Undangan kontak darurat belum dibuka.</p>
        ))}
      {inviting && view && (
        <Modal title="Undang kontak darurat" onClose={() => setInviting(false)}>
          <InviteForm
            needsConsent={!view.shareConsented}
            onSent={(email) => {
              setInviting(false);
              setMessage(`Undangan dikirim ke ${email}. Berlaku 7 hari.`);
              setRevision((r) => r + 1);
            }}
          />
        </Modal>
      )}
    </section>
  );
}

function InviteForm({ needsConsent, onSent }: { needsConsent: boolean; onSent: (email: string) => void }) {
  const id = useId();
  const v = useFieldErrors();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !v.check(e.currentTarget)) return;
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    try {
      await api("/api/emergency-contacts", {
        method: "POST",
        body: JSON.stringify({ name: f.get("name"), email, shareAccepted: f.get("shareAccepted") === "on" }),
      });
      onSent(email);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" noValidate onSubmit={submit} onInput={(e) => v.clear(e.target)} onChange={(e) => v.clear(e.target)}>
      <ErrorMessage error={error} />
      <div className="field">
        <label htmlFor={`${id}-name`}>Nama kontak</label>
        <input id={`${id}-name`} name="name" required maxLength={120} autoComplete="off" {...v.field("name")} />
        {v.error("name")}
      </div>
      <div className="field">
        <label htmlFor={`${id}-email`}>Email kontak</label>
        <input id={`${id}-email`} name="email" type="email" required maxLength={254} autoComplete="off" {...v.field("email")} />
        {v.error("email")}
      </div>
      {needsConsent && (
        <div>
          <label className="check">
            <input name="shareAccepted" type="checkbox" required {...v.field("shareAccepted")} />
            <span>{CONTACT_SHARE_TEXT}</span>
          </label>
          {v.error("shareAccepted")}
        </div>
      )}
      <p className="small muted">Email undangan hanya berisi nama Anda dan tautan untuk menerima atau menolak.</p>
      <button className="button primary" disabled={busy}>
        {busy ? "Mengirim…" : "Kirim undangan"}
      </button>
    </form>
  );
}
