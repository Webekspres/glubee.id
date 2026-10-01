"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/ui";
import { ErrorMessage, Loading, Modal, PageHeading, useFieldErrors } from "./Ui";
import { Icon } from "./Icons";

type Account = {
  user_id: string;
  email: string;
  email_confirmed: boolean;
  account_status: string;
  is_admin: boolean;
  created_at: string;
};
type AuditEvent = {
  occurred_at: string;
  action: string;
  reason: string;
  old_state: string | null;
  new_state: string | null;
  actor_email: string | null;
  subject_email: string | null;
};

const STATUS: Record<string, string> = {
  onboarding: "Belum lengkap",
  active: "Aktif",
  suspended: "Dinonaktifkan",
  deletion_pending: "Menunggu penghapusan",
  deleted: "Dihapus",
};
const ACTIONS: Record<string, string> = {
  set_account_status: "Ubah status",
  create_verified_demo_account: "Buat akun demo",
  seed_demo_data: "Isi data contoh",
};
const when = (v: string) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(v)) + " WIB";

// Halaman admin (FR-ADMIN-001): hanya identitas minimum dan status akun.
// Tidak ada endpoint di sini yang mengembalikan data kesehatan.
export function AdminPanel() {
  const [state, setState] = useState<"loading" | "login" | "denied" | "admin">("loading");
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<unknown>(null);

  const loadAudit = useCallback(async () => {
    try {
      setAudit((await api<AuditEvent[]>("/api/admin/audit")).data);
      setState("admin");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setState("login");
      else if (e instanceof ApiError && e.status === 403) setState("denied");
      else {
        setError(e);
        setState("login");
      }
    }
  }, []);

  useEffect(() => {
    // Pemuatan awal sesi admin; setState terjadi setelah fetch selesai.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAudit();
  }, [loadAudit]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    setState("login");
  }

  if (state === "loading")
    return <Loading label="Memeriksa sesi admin…" />;
  if (state === "login") return <AdminLogin error={error} onDone={loadAudit} />;
  if (state === "denied")
    return (
      <div className="narrow stack">
        <PageHeading title="Akses admin" />
        <p className="message error" role="alert">
          Akun yang sedang masuk tidak memiliki akses admin.
        </p>
        <button className="button" onClick={logout}>
          Keluar dan masuk dengan akun admin
        </button>
      </div>
    );

  return (
    <div className="stack admin">
      <PageHeading
        title="Admin akun"
        description="Cari akun, ubah status dengan alasan, dan buat akun demo. Data gula darah tidak tersedia di halaman ini."
      >
        <button className="button logout" onClick={logout}>
          <Icon name="logout" />
          Keluar
        </button>
      </PageHeading>
      <AccountSearch onChanged={loadAudit} />
      <DemoAccountForm onCreated={loadAudit} />
      <section className="panel stack">
        <h2>Riwayat tindakan admin</h2>
        {audit.length === 0 ? (
          <p className="muted">Belum ada tindakan admin yang tercatat.</p>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Riwayat tindakan admin">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Tindakan</th>
                  <th>Akun</th>
                  <th>Perubahan</th>
                  <th>Alasan</th>
                  <th>Oleh</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e, i) => (
                  <tr key={i}>
                    <td>{when(e.occurred_at)}</td>
                    <td>{ACTIONS[e.action] ?? e.action}</td>
                    <td>{e.subject_email ?? "Akun terhapus"}</td>
                    <td>
                      {e.old_state || e.new_state
                        ? `${STATUS[e.old_state ?? ""] ?? "-"} ke ${STATUS[e.new_state ?? ""] ?? "-"}`
                        : "-"}
                    </td>
                    <td>{e.reason}</td>
                    <td>{e.actor_email ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AdminLogin({ error, onDone }: { error: unknown; onDone: () => void }) {
  const v = useFieldErrors();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<unknown>(error);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !v.check(e.currentTarget)) return;
    setBusy(true);
    setFailed(null);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      onDone();
    } catch (err) {
      setFailed(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <PageHeading title="Masuk admin" description="Khusus pengelola Glubee." />
      <section className="panel">
        <form className="form" noValidate onSubmit={submit} onInput={(e) => v.clear(e.target)}>
          <ErrorMessage error={failed} />
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" name="email" type="email" autoComplete="username" required {...v.field("email")} />
            {v.error("email")}
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" name="password" type="password" autoComplete="current-password" required {...v.field("password")} />
            {v.error("password")}
          </div>
          <button className="button primary" disabled={busy}>
            {busy ? "Memproses…" : "Masuk sebagai admin"}
          </button>
        </form>
      </section>
    </div>
  );
}

function AccountSearch({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Account[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<Account | null>(null);
  const [reason, setReason] = useState("");

  async function search(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setResults((await api<Account[]>("/api/admin/accounts?q=" + encodeURIComponent(query))).data);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/accounts/${target.user_id}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: target.account_status === "suspended" ? "active" : "suspended",
          reason,
        }),
      });
      setTarget(null);
      setReason("");
      await search();
      onChanged();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const suspending = target?.account_status !== "suspended";
  return (
    <section className="panel stack">
      <h2>Cari akun</h2>
      <form className="admin-search" onSubmit={search} role="search">
        <div className="field">
          <label htmlFor="admin-query">Email (minimal 3 karakter)</label>
          <input id="admin-query" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button className="button primary" disabled={busy || query.trim().length < 3}>
          Cari
        </button>
      </form>
      {!target && <ErrorMessage error={error} />}
      {results && results.length === 0 && <p className="muted">Tidak ada akun dengan email itu.</p>}
      {results && results.length > 0 && (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Hasil pencarian akun">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {results.map((a) => (
                <tr key={a.user_id}>
                  <td>
                    {a.email}{" "}
                    {a.is_admin && <span className="badge">Admin</span>}{" "}
                    {!a.email_confirmed && <span className="badge invalid">Belum verifikasi</span>}
                  </td>
                  <td>{STATUS[a.account_status] ?? a.account_status}</td>
                  <td>{when(a.created_at)}</td>
                  <td>
                    {!a.is_admin && !["deletion_pending", "deleted"].includes(a.account_status) && (
                      <button className="text-button" onClick={() => setTarget(a)}>
                        {a.account_status === "suspended" ? "Aktifkan kembali" : "Nonaktifkan"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {target && (
        <Modal
          title={suspending ? "Nonaktifkan akun" : "Aktifkan kembali akun"}
          busy={busy}
          onClose={() => setTarget(null)}
        >
          <div className="stack">
            <p>
              <strong>{target.email}</strong>
              <br />
              {suspending
                ? "Pengguna tidak dapat mencatat atau melihat data sampai akun diaktifkan kembali."
                : "Status kembali sesuai kelengkapan akun (Aktif atau Belum lengkap)."}
            </p>
            <label className="field">
              Alasan (wajib, tercatat di riwayat admin)
              <textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <ErrorMessage error={error} />
            <div className="actions">
              <button className="button" disabled={busy} onClick={() => setTarget(null)}>
                Batal
              </button>
              <button
                className={suspending ? "button danger" : "button primary"}
                disabled={busy || reason.trim().length < 5}
                onClick={changeStatus}
              >
                {suspending ? "Nonaktifkan akun" : "Aktifkan kembali"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DemoAccountForm({ onCreated }: { onCreated: () => void }) {
  const v = useFieldErrors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (busy || !v.check(form)) return;
    setBusy(true);
    setError(null);
    setCreated("");
    const f = new FormData(form);
    try {
      const r = await api<{ email: string; sampleEntries: number }>("/api/admin/demo-accounts", {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
          withSample: f.get("withSample") === "on",
        }),
      });
      setCreated(
        r.data.sampleEntries
          ? `Akun demo ${r.data.email} siap dipakai, sudah berisi ${r.data.sampleEntries} catatan contoh.`
          : `Akun demo ${r.data.email} siap dipakai.`,
      );
      form.reset();
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <h2>Buat akun demo klien</h2>
      <p className="muted">
        Email langsung terverifikasi tanpa tautan konfirmasi. Hanya untuk akun demo milik Webekspres,
        bukan akun pasien sungguhan.
      </p>
      <form className="form" noValidate onSubmit={submit} onInput={(e) => v.clear(e.target)}>
        <ErrorMessage error={error} />
        {created && (
          <p className="message success" role="status">
            {created}
          </p>
        )}
        <div className="form-row">
          <div className="field">
            <label htmlFor="demo-email">Email akun demo</label>
            <input id="demo-email" name="email" type="email" autoComplete="off" required {...v.field("email")} />
            {v.error("email")}
          </div>
          <div className="field">
            <label htmlFor="demo-password">Password (minimal 12 karakter)</label>
            <input id="demo-password" name="password" type="password" autoComplete="new-password" minLength={12} required {...v.field("password")} />
            {v.error("password")}
          </div>
        </div>
        <label className="check">
          <input name="withSample" type="checkbox" defaultChecked />
          <span>
            Langsung isi profil Demo Glubee, persetujuan layanan, dan 14 hari catatan contoh
            (data sintetis) agar klien bisa langsung melihat grafik dan laporan.
          </span>
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? "Membuat…" : "Buat akun demo"}
        </button>
      </form>
    </section>
  );
}
