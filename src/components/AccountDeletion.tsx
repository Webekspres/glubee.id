"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { deletionSchedule } from "@/lib/domain/deletion";
import { api, ApiError, type Timezone } from "@/lib/ui";
import { ErrorMessage, Modal } from "./Ui";
import { leavePage } from "./TransitionLink";

type Method = "password" | "recent_login" | "relogin_required";

// GLB-024: ajukan penghapusan (Profil) atau batalkan selama masa jeda (Status akun).
export function AccountDeletion({ mode, zone }: { mode: "request" | "cancel"; zone: Timezone }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const request = mode === "request";
  // Perkiraan jadwal untuk ditampilkan sebelum pengajuan; jadwal pasti dari server.
  const [estimate] = useState(() =>
    deletionSchedule(new Date(Date.now() + 3 * 864e5).toISOString(), zone),
  );

  async function start() {
    setError(null);
    setOpen(true);
    try {
      setMethod((await api<{ method: Method }>("/api/account/export")).data.method);
    } catch (e) {
      setError(e);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/account/deletion", {
        method: request ? "POST" : "DELETE",
        body: JSON.stringify({ password: f.get("password"), confirm: f.get("confirm") === "on" }),
      });
      setOpen(false);
      leavePage(() => {
        router.replace(request ? "/account-status" : "/dashboard");
        router.refresh();
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && method === "recent_login") setMethod("relogin_required");
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={request ? "stack danger-zone" : "stack"}>
      {request && (
        <div>
          <h3>Hapus akun</h3>
          <p className="small muted">
            Akun dan semua data Anda dihapus permanen 3 hari setelah pengajuan. Selama 3 hari itu
            Anda masih bisa mengunduh data atau membatalkan.
          </p>
        </div>
      )}
      <button className={request ? "button danger" : "button primary"} onClick={start}>
        {request ? "Hapus akun saya" : "Batalkan penghapusan"}
      </button>
      {open && (
        <Modal
          title={request ? "Hapus akun Glubee?" : "Batalkan penghapusan akun?"}
          busy={busy}
          onClose={() => setOpen(false)}
        >
          {method === null && !error && <p className="muted">Memeriksa akun…</p>}
          {method === "relogin_required" ? (
            <div className="stack">
              <p>
                Akun Anda masuk dengan Google. Demi keamanan, masuk ulang dengan Google, lalu ulangi
                dalam 10 menit.
              </p>
              <a className="button primary" href="/api/auth/google?next=/profile">
                Masuk ulang dengan Google
              </a>
            </div>
          ) : (
            method && (
              <form className="form" onSubmit={submit}>
                <ErrorMessage error={error} />
                {request ? (
                  <>
                    <ul className="deletion-facts">
                      <li>Semua catatan gula darah, laporan, profil, dan bukti persetujuan akan dihapus.</li>
                      <li>Selama masa jeda, pencatatan dan pengingat berhenti.</li>
                      <li>
                        Jadwal penghapusan sekitar <strong>{estimate.local}</strong> ({estimate.utc}).
                      </li>
                      <li>Salinan cadangan sistem kedaluwarsa paling lambat 8 hari setelahnya.</li>
                    </ul>
                    <label className="check">
                      <input name="confirm" type="checkbox" required />
                      <span>Saya mengerti akun dan data saya akan dihapus permanen setelah 3 hari.</span>
                    </label>
                  </>
                ) : (
                  <p>Akun kembali seperti sebelum pengajuan. Pengingat lama tidak dikirim ulang.</p>
                )}
                {method === "password" && (
                  <label className="field">
                    Password akun
                    <input name="password" type="password" autoComplete="current-password" required />
                  </label>
                )}
                <div className="actions">
                  <button type="button" className="button" disabled={busy} onClick={() => setOpen(false)}>
                    {request ? "Jangan hapus" : "Kembali"}
                  </button>
                  <button className={request ? "button danger" : "button primary"} disabled={busy}>
                    {busy ? "Memproses…" : request ? "Ya, hapus akun saya" : "Batalkan penghapusan"}
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

// Jadwal pasti dari server untuk halaman Status akun.
export function DeletionSchedule({ zone }: { zone: Timezone }) {
  const [state, setState] = useState<{ scheduledFor: string } | null | undefined>(undefined);
  useEffect(() => {
    let ignore = false;
    api<{ scheduledFor: string } | null>("/api/account/deletion")
      .then(({ data }) => !ignore && setState(data))
      .catch(() => !ignore && setState(null));
    return () => {
      ignore = true;
    };
  }, []);
  if (!state) return null;
  const s = deletionSchedule(state.scheduledFor, zone);
  return (
    <div className="notice deletion-schedule" role="status">
      <strong>Dijadwalkan dihapus: {s.local}</strong>
      <span>{s.utc}</span>
    </div>
  );
}
