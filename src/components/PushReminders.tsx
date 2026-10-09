"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/ui";
import { ErrorMessage } from "./Ui";

// GLB-020 / FR-REMINDER-001: aktifkan browser push per perangkat. Push hanya pelengkap:
// tanpa izin/dukungan, pengingat tetap lewat email (bila aktif) dan tampil di dashboard.

type Config = { push: boolean; email: boolean; publicKey: string | null };
type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64url: string) {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches;

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export function PushReminders() {
  const [config, setConfig] = useState<Config | null>(null),
    [state, setState] = useState<State>("loading"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let ignore = false;
    api<Config>("/api/push-subscriptions")
      .then(async ({ data }) => {
        if (ignore) return;
        setConfig(data);
        if (!data.push) return;
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
          return setState(isIos() && !standalone() ? "ios-install" : "unsupported");
        if (Notification.permission === "denied") return setState("denied");
        const sub = await currentSubscription();
        if (!ignore) setState(sub ? "on" : "off");
      })
      .catch(() => !ignore && setConfig({ push: false, email: false, publicKey: null }));
    return () => {
      ignore = true;
    };
  }, []);

  async function enable() {
    if (!config?.publicKey) return;
    setBusy(true);
    setError(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) }));
      await api("/api/push-subscriptions", { method: "POST", body: JSON.stringify(sub.toJSON()) });
      setState("on");
    } catch (e) {
      setError(e instanceof ApiError ? e : new Error("Notifikasi belum dapat diaktifkan di browser ini."));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await api("/api/push-subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!config) return null;
  const fallback = config.email
    ? "Tanpa notifikasi browser, pengingat dikirim ke email Anda."
    : "Jadwal tetap tampil di halaman ini dan di beranda.";

  if (!config.push)
    return (
      <p className="notice schedule-notice">
        {config.email
          ? "Saat jadwal tiba, pengingat dikirim ke email Anda."
          : "Pengingat otomatis untuk jadwal sedang disiapkan. Untuk saat ini, jadwal tampil di halaman ini."}
      </p>
    );

  return (
    <div className="notice schedule-notice push-reminders" aria-live="polite">
      {state === "on" && (
        <>
          <p>Notifikasi pengingat aktif di perangkat ini.</p>
          <button className="button quiet" onClick={disable} disabled={busy}>
            Matikan notifikasi
          </button>
        </>
      )}
      {state === "off" && (
        <>
          <p>Terima notifikasi di perangkat ini saat jadwal tiba. {fallback}</p>
          <button className="button primary" onClick={enable} disabled={busy}>
            {busy ? "Mengaktifkan…" : "Aktifkan notifikasi"}
          </button>
        </>
      )}
      {state === "denied" && (
        <p>Notifikasi diblokir di pengaturan browser. Izinkan notifikasi untuk situs ini bila ingin menerimanya. {fallback}</p>
      )}
      {state === "ios-install" && (
        <p>
          Di iPhone atau iPad, notifikasi hanya bisa diterima setelah Glubee dipasang: ketuk Bagikan, lalu
          “Tambahkan ke Layar Utama”, dan buka Glubee dari sana. {fallback}
        </p>
      )}
      {state === "unsupported" && <p>Browser ini tidak mendukung notifikasi. {fallback}</p>}
      <ErrorMessage error={error} />
    </div>
  );
}
