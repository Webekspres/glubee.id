"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  accountDestination,
  dateTime,
  type Profile,
  type Receipt,
} from "@/lib/ui";
import { APP_CONFIG } from "@/lib/config";
import { ConsentFields, consentFields } from "./ConsentFields";
import { ErrorMessage } from "./Ui";
const versions: Record<string, string> = {
  age_and_region: APP_CONFIG.noticeVersions.ageAndRegion,
  legal_documents: APP_CONFIG.noticeVersions.legalDocuments,
  health_data: APP_CONFIG.noticeVersions.healthData,
};
export function ProfileForm({
  profile,
  onboarding = false,
}: {
  profile: Profile;
  onboarding?: boolean;
}) {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [zone, setZone] = useState(profile.timezone_code ?? "");
  useEffect(() => {
    let ignore = false;
    api<Receipt[]>("/api/consents")
      .then((r) => {
        if (!ignore) setReceipts(r.data);
      })
      .catch((e) => {
        if (!ignore) setError(e);
      });
    return () => {
      ignore = true;
    };
  }, []);
  const needed = Object.entries(versions)
    .filter(([type, version]) => {
      const r = receipts?.find((r) => r.consent_type === type);
      return !r || r.decision !== "accept" || r.document_version !== version;
    })
    .map(([type]) => type);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      for (const [name, type] of consentFields)
        if (needed.includes(type)) {
          if (f.get(name) !== "on")
            throw new Error("Lengkapi persetujuan wajib.");
          await api("/api/consents", {
            method: "POST",
            body: JSON.stringify({
              consentType: type,
              decision: "accept",
              method: "onboarding",
            }),
          });
        }
      const r = await api<Profile>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(f)),
      });
      if (onboarding) router.replace(accountDestination(r.data.account_status));
      else {
        setMessage("Profil berhasil diperbarui.");
        const c = await api<Receipt[]>("/api/consents");
        setReceipts(c.data);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="panel">
        <h2>{onboarding ? "Lengkapi profil Anda" : "Informasi pribadi"}</h2>
        <p className="muted small" style={{ margin: "8px 0 24px" }}>
          Zona waktu digunakan untuk tanggal pengukuran, grafik, dan laporan.
        </p>
        <form className="form" onSubmit={submit}>
          <ErrorMessage error={error} />
          {message && (
            <p role="status" className="message success">
              {message}
            </p>
          )}
          <label className="field">
            Nama
            <input
              name="name"
              autoComplete="name"
              defaultValue={profile.name ?? ""}
              maxLength={120}
              required
            />
          </label>
          <div className="form-row">
            <label className="field">
              Tanggal lahir
              <input
                type="date"
                name="birthDate"
                autoComplete="bday"
                defaultValue={profile.birth_date ?? ""}
                required
              />
            </label>
            <label className="field">
              Jenis kelamin
              <select name="sex" defaultValue={profile.sex ?? ""} required>
                <option value="" disabled>
                  Pilih jenis kelamin
                </option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </label>
          </div>
          <label className="field">
            Zona waktu
            <select
              name="timezoneCode"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              required
            >
              <option value="" disabled>
                Pilih zona waktu
              </option>
              <option value="WIB">WIB · Indonesia Barat (UTC+7)</option>
              <option value="WITA">WITA · Indonesia Tengah (UTC+8)</option>
              <option value="WIT">WIT · Indonesia Timur (UTC+9)</option>
            </select>
          </label>
          {receipts && needed.length > 0 && <ConsentFields needed={needed} />}
          <button className="button primary" disabled={busy || !receipts}>
            {busy
              ? "Menyimpan…"
              : onboarding
                ? "Simpan & lanjutkan"
                : "Simpan perubahan"}
          </button>
        </form>
      </section>
      {!onboarding && (
        <>
          <section className="panel">
            <h2>Bukti persetujuan</h2>
            <p className="small muted">
              Riwayat keputusan dan versi dokumen yang Anda setujui.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Persetujuan</th>
                    <th>Keputusan / versi</th>
                    <th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts?.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {(
                          {
                            age_and_region: "Usia & wilayah",
                            legal_documents: "Dokumen layanan",
                            health_data: "Data kesehatan",
                          } as Record<string, string>
                        )[r.consent_type] ?? r.consent_type}
                      </td>
                      <td>
                        {
                          (
                            {
                              accept: "Diterima",
                              decline: "Ditolak",
                              withdraw: "Ditarik",
                            } as Record<string, string>
                          )[r.decision]
                        }
                        <br />
                        <span className="small">
                          {r.document_version.split("@")[1]}
                        </span>
                      </td>
                      <td>{dateTime(r.recorded_at, profile.timezone_code!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel stack">
            <h2>Privasi & hak Anda</h2>
            <button
              className="button"
              onClick={() =>
                window.dispatchEvent(new Event("open-cookie-preferences"))
              }
            >
              Pengaturan Cookie
            </button>
            <p className="small muted">
              Penghapusan akun memiliki masa jeda 7 hari. Fitur pengajuan dan
              ekspor akun dijadwalkan pada Sprint 3. Untuk permintaan hak data
              atau penarikan persetujuan, lihat kanal pengelola pada{" "}
              <a href="/privacy">Kebijakan Privasi</a>.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
