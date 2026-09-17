"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/ui";
import { Modal, ErrorMessage } from "./Ui";
export function CookieConsent() {
  const [visible, setVisible] = useState(false),
    [modal, setModal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let ignore = false;
    api<{ current: boolean }>("/api/consents/cookie")
      .then((r) => {
        if (!ignore) setVisible(!r.data.current);
      })
      .catch(() => {
        if (!ignore) setVisible(true);
      });
    const open = () => setModal(true);
    window.addEventListener("open-cookie-preferences", open);
    return () => {
      ignore = true;
      window.removeEventListener("open-cookie-preferences", open);
    };
  }, []);
  async function save(decisionSource: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/consents/cookie", {
        method: "POST",
        body: JSON.stringify({
          decisionSource,
          preferences: { essential: true, analytics: false, marketing: false },
        }),
      });
      setVisible(false);
      setModal(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const actions = (
    <div className="actions">
      <button className="button" disabled={busy} onClick={() => save("reject")}>
        Tolak non-esensial
      </button>
      <button className="button" disabled={busy} onClick={() => setModal(true)}>
        Atur pilihan
      </button>
      <button
        className="button primary"
        disabled={busy}
        onClick={() => save("accept_all")}
      >
        Terima semua
      </button>
    </div>
  );
  return (
    <>
      {visible && !modal && (
        <section className="cookie-banner" aria-label="Pilihan cookie">
          <div>
            <h3>Privasi tetap dalam kendali Anda</h3>
            <p>
              Glubee memakai cookie esensial untuk login, keamanan, dan pilihan
              privasi. Saat ini tidak ada analytics atau marketing yang
              dijalankan. Pilihan dapat diubah kapan saja.
            </p>
            <ErrorMessage error={error} />
          </div>
          {actions}
        </section>
      )}
      {modal && (
        <Modal
          title="Pengaturan Cookie"
          busy={busy}
          onClose={() => setModal(false)}
        >
          <div className="stack">
            <p className="small muted">
              Hanya cookie esensial yang digunakan pada versi ini. “Terima
              semua” hanya berlaku untuk kategori yang tersedia.
            </p>
            <label className="check">
              <input type="checkbox" checked disabled />
              <span>
                <strong>Esensial · selalu aktif</strong>
                <br />
                Login, keamanan, dan menyimpan pilihan privasi.
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={false} disabled />
              <span>
                <strong>Analytics · belum tersedia</strong>
                <br />
                Vendor dan tujuan belum disetujui.
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={false} disabled />
              <span>
                <strong>Marketing · tidak digunakan</strong>
                <br />
                Tidak ada pelacakan pemasaran.
              </span>
            </label>
            <ErrorMessage error={error} />
            <div className="actions">
              <button
                className="button"
                disabled={busy}
                onClick={() => save("withdraw")}
              >
                Tarik non-esensial
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => save("preferences")}
              >
                Simpan pilihan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
