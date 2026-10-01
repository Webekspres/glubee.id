"use client";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/ui";
import { Icon } from "./Icons";
import { ErrorMessage, Modal } from "./Ui";

type Method = "password" | "recent_login" | "relogin_required";

// GLB-023: unduh semua data milik sendiri (JSON) setelah konfirmasi identitas.
export function ExportData() {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState("");

  async function start() {
    setError(null);
    setDone("");
    setOpen(true);
    try {
      setMethod((await api<{ method: Method }>("/api/account/export")).data.method);
    } catch (e) {
      setError(e);
    }
  }

  async function download(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const password = new FormData(e.currentTarget).get("password");
    try {
      const res = await fetch("/api/account/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "REAUTH_REQUIRED") setMethod("relogin_required");
        throw new ApiError(
          body?.error?.message ?? "Ekspor belum dapat dibuat. Coba lagi.",
          res.status,
          body?.error?.fieldErrors,
        );
      }
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "glubee-data.json";
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
      setDone(`File ${name} sudah diunduh. Simpan di tempat yang aman: isinya data kesehatan Anda.`);
      setOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack export-data">
      <div>
        <h3>Unduh data saya</h3>
        <p className="small muted">
          Satu file JSON berisi profil, semua catatan gula darah (termasuk yang ditandai salah),
          dan bukti persetujuan Anda. File dibuat saat diminta dan tidak disimpan di server.
        </p>
      </div>
      <button className="button" onClick={start}>
        <Icon name="report" />
        Unduh data saya
      </button>
      {done && (
        <p className="message success" role="status">
          {done}
        </p>
      )}
      {open && (
        <Modal title="Konfirmasi untuk mengunduh data" busy={busy} onClose={() => setOpen(false)}>
          {method === null && !error && <p className="muted">Memeriksa akun…</p>}
          {method === "relogin_required" ? (
            <div className="stack">
              <p>
                Akun Anda masuk dengan Google. Demi keamanan, masuk ulang dengan Google, lalu
                unduh dari halaman Profil dalam 10 menit.
              </p>
              <ErrorMessage error={error instanceof ApiError && error.status === 401 ? null : error} />
              <a className="button primary" href="/api/auth/google?next=/profile">
                Masuk ulang dengan Google
              </a>
            </div>
          ) : (
            method && (
              <form className="form" onSubmit={download}>
                <ErrorMessage error={error} />
                {method === "password" ? (
                  <label className="field">
                    Password akun
                    <input name="password" type="password" autoComplete="current-password" required />
                    <small>Untuk memastikan yang mengunduh adalah Anda.</small>
                  </label>
                ) : (
                  <p>Anda baru saja masuk dengan Google, jadi data dapat langsung diunduh.</p>
                )}
                <div className="actions">
                  <button type="button" className="button" disabled={busy} onClick={() => setOpen(false)}>
                    Batal
                  </button>
                  <button className="button primary" disabled={busy}>
                    {busy ? "Menyiapkan file…" : "Unduh file JSON"}
                  </button>
                </div>
              </form>
            )
          )}
        </Modal>
      )}
    </div>
  );
}
