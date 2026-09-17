"use client";
import { useRef, useState } from "react";
import {
  api,
  CONTEXT_LABELS,
  dateTime,
  numberText,
  type Entry,
  type Timezone,
} from "@/lib/ui";
import { Modal, ErrorMessage } from "./Ui";
import { GlucoseEntryForm } from "./GlucoseEntryForm";

const CONTEXT_ICONS: Record<string, string> = {
  fasting: "☀️",
  before_meal: "🥗",
  after_meal: "🍽️",
  random: "⚡",
  other: "📝",
};

export function EntryTable({
  entries,
  zone,
  onChanged,
}: {
  entries: Entry[];
  zone: Timezone;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState<Entry | null>(null),
    [replace, setReplace] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [reason, setReason] = useState("");
  const key = useRef("");

  function open(e: Entry) {
    key.current = crypto.randomUUID();
    setTarget(e);
    setReplace(e.status === "invalid");
    setError(null);
    setReason("");
  }

  async function invalidate() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/glucose-entries/" + target.id + "/invalidate", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body: JSON.stringify({ reason }),
      });
      setTarget({ ...target, status: "invalid" });
      setReplace(true);
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!entries.length)
    return (
      <div className="empty">
        <h3>Belum ada catatan</h3>
        <p className="muted">
          Coba periode lain atau tambahkan pengukuran pertama Anda.
        </p>
        <a href="/log" className="button primary">
          Catat gula darah
        </a>
      </div>
    );

  return (
    <>
      {/* Mobile-first touch friendly interactive cards */}
      <div className="mobile-entry-cards" role="list">
        {entries.map((e) => {
          const hasReplacement = entries.some(
            (other) => other.replacement_for_id === e.id,
          );
          const icon = CONTEXT_ICONS[e.measurement_context] ?? "📝";
          return (
            <div
              key={e.id}
              className={`mobile-entry-card ${e.status === "invalid" ? "is-invalid" : ""}`}
              onClick={() => {
                if (!hasReplacement) open(e);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(evt) => {
                if ((evt.key === "Enter" || evt.key === " ") && !hasReplacement) {
                  evt.preventDefault();
                  open(e);
                }
              }}
              aria-label={`Catatan ${CONTEXT_LABELS[e.measurement_context]} ${e.original_value} ${e.original_unit}`}
            >
              <div className="mobile-card-top">
                <div className="mobile-card-identity">
                  <span className="mobile-card-icon" aria-hidden="true">
                    {icon}
                  </span>
                  <div>
                    <h3 className="mobile-card-title">
                      {CONTEXT_LABELS[e.measurement_context]}
                    </h3>
                    <p className="mobile-card-time">
                      {dateTime(e.measured_at, zone)}
                    </p>
                  </div>
                </div>
                <div className="mobile-card-value-block">
                  <span
                    className={`mobile-card-val ${e.status === "invalid" ? "invalid-value" : ""}`}
                  >
                    {numberText(Number(e.original_value))}
                  </span>
                  <span className="mobile-card-unit">{e.original_unit}</span>
                  {e.original_unit === "mmol/L" && (
                    <span className="mobile-card-equiv">
                      ≈ {numberText(Number(e.normalized_mg_dl))} mg/dL
                    </span>
                  )}
                </div>
              </div>

              {(e.note || e.invalidation_reason || e.replacement_for_id) && (
                <div className="mobile-card-details">
                  {e.note && <p className="entry-note small muted">{e.note}</p>}
                  {e.invalidation_reason && (
                    <p className="entry-note small invalid">
                      Alasan koreksi: {e.invalidation_reason}
                    </p>
                  )}
                  {e.replacement_for_id && (
                    <p className="small muted">
                      Pengganti catatan {e.replacement_for_id.slice(0, 8)}
                    </p>
                  )}
                </div>
              )}

              <div className="mobile-card-footer">
                <span
                  className={
                    "badge" + (e.status === "invalid" ? " invalid" : "")
                  }
                >
                  {e.status === "invalid" ? "Ditandai salah" : "Aktif"}
                </span>

                {!hasReplacement && (
                  <span className="mobile-card-action">
                    {e.status === "valid" ? "Koreksi catatan →" : "Buat pengganti →"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop traditional table view */}
      <div className="table-scroll desktop-table-view">
        <table>
          <thead>
            <tr>
              <th>Waktu pengukuran</th>
              <th>Hasil</th>
              <th>Kondisi / catatan</th>
              <th>Status catatan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{dateTime(e.measured_at, zone)}</td>
                <td>
                  <strong
                    className={e.status === "invalid" ? "invalid-value" : ""}
                  >
                    {numberText(Number(e.original_value))}
                  </strong>{" "}
                  <span className="small">{e.original_unit}</span>
                  {e.original_unit === "mmol/L" && (
                    <p className="small muted">
                      ≈ {numberText(Number(e.normalized_mg_dl))} mg/dL
                    </p>
                  )}
                </td>
                <td>
                  {CONTEXT_LABELS[e.measurement_context]}
                  {e.note && <p className="entry-note small muted">{e.note}</p>}
                  {e.invalidation_reason && (
                    <p className="entry-note small">
                      Alasan koreksi: {e.invalidation_reason}
                    </p>
                  )}
                  {e.replacement_for_id && (
                    <p className="small muted">
                      Pengganti catatan {e.replacement_for_id.slice(0, 8)}
                    </p>
                  )}
                </td>
                <td>
                  <span
                    className={
                      "badge" + (e.status === "invalid" ? " invalid" : "")
                    }
                  >
                    {e.status === "invalid" ? "Ditandai salah" : "Aktif"}
                  </span>
                  {e.status === "valid" && (
                    <p className="small muted">Status belum dievaluasi</p>
                  )}
                </td>
                <td>
                  {!entries.some(
                    (other) => other.replacement_for_id === e.id,
                  ) && (
                    <button
                      className="text-button small"
                      onClick={() => open(e)}
                    >
                      {e.status === "valid"
                        ? "Koreksi catatan"
                        : "Buat pengganti"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {target && (
        <Modal
          title={replace ? "Catatan pengganti" : "Tandai catatan sebagai salah"}
          busy={busy}
          onClose={() => setTarget(null)}
        >
          {replace ? (
            <GlucoseEntryForm
              zone={zone}
              replacement={target}
              onBusy={setBusy}
              onSaved={() => {
                setTarget(null);
                onChanged();
              }}
            />
          ) : (
            <div className="stack">
              <p>
                Catatan asli tetap ada di riwayat pribadi, tetapi dikeluarkan
                dari grafik, laporan, ringkasan, status, dan alarm. Setelah
                melanjutkan, Anda dapat membuat catatan pengganti. Pesan yang
                sudah terkirim tidak dapat ditarik.
              </p>
              <p className="notice">
                {numberText(Number(target.original_value))}{" "}
                {target.original_unit} · {dateTime(target.measured_at, zone)}
              </p>
              <label className="field">
                Alasan koreksi (opsional)
                <textarea
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <ErrorMessage error={error} />
              <div className="actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => setTarget(null)}
                >
                  Batal
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={invalidate}
                >
                  Tandai salah & lanjutkan
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
