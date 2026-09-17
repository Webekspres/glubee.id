"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  CONTEXT_LABELS,
  api,
  localInput,
  localToUtc,
  type Entry,
  type Timezone,
} from "@/lib/ui";
import { ErrorMessage } from "./Ui";

export function GlucoseEntryForm({
  zone,
  replacement,
  onSaved,
  onBusy,
}: {
  zone: Timezone;
  replacement?: Entry;
  onSaved: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);

  const [maxTime, setMaxTime] = useState(() => localInput(new Date(), zone));

  const [time] = useState(() =>
    replacement
      ? localInput(new Date(replacement.measured_at), zone)
      : maxTime,
  );

  const attempt = useRef<{ body: string; key: string } | null>(null);

  const refreshMax = () => {
    setMaxTime(localInput(new Date(), zone));
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    onBusy?.(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const measuredAt = localToUtc(String(f.get("measuredAt")), zone);
      if (!measuredAt) throw new Error("Waktu pengukuran tidak valid.");

      // Batasi agar tidak forward-date/forward-time berdasarkan sistem waktu perangkat pengguna
      const measuredDate = new Date(measuredAt);
      if (measuredDate.valueOf() > Date.now() + 60_000) {
        throw new Error("Waktu pengukuran tidak boleh melebihi waktu saat ini.");
      }

      const body = JSON.stringify({
        originalValue: Number(f.get("originalValue")),
        originalUnit: f.get("originalUnit"),
        measurementContext: f.get("measurementContext"),
        measuredAt,
        note: f.get("note"),
      });
      if (attempt.current?.body !== body)
        attempt.current = { body, key: crypto.randomUUID() };
      await api(
        replacement
          ? "/api/glucose-entries/" + replacement.id + "/replacement"
          : "/api/glucose-entries",
        {
          method: "POST",
          body,
          headers: { "Idempotency-Key": attempt.current.key },
        },
      );
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <ErrorMessage error={error} />
      {replacement && (
        <p className="notice">
          Catatan pengganti akan ditautkan ke catatan lama yang telah ditandai
          salah.
        </p>
      )}
      <div className="form-row">
        <label className="field">
          Hasil pengukuran
          <input
            name="originalValue"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            required
            defaultValue={replacement?.original_value}
          />
        </label>
        <label className="field">
          Satuan
          <select
            name="originalUnit"
            defaultValue={replacement?.original_unit ?? "mg/dL"}
          >
            <option>mg/dL</option>
            <option>mmol/L</option>
          </select>
        </label>
      </div>
      <label className="field">
        Kondisi pengukuran
        <select
          name="measurementContext"
          defaultValue={replacement?.measurement_context ?? ""}
          required
        >
          <option value="" disabled>
            Pilih kondisi saat mengukur
          </option>
          {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <small>
          Puasa: tanpa asupan kalori minimal 8 jam. Setelah makan: 2 jam setelah
          makan.
        </small>
      </label>
      <label className="field">
        Waktu pengukuran ({zone})
        <input
          name="measuredAt"
          type="datetime-local"
          defaultValue={time}
          max={maxTime}
          onFocus={refreshMax}
          onClick={refreshMax}
          required
        />
        <small>
          Gunakan waktu pengukuran sebenarnya (maksimal waktu saat ini),
          termasuk untuk catatan sebelumnya.
        </small>
      </label>
      <label className="field">
        Catatan tambahan <span className="muted small">Opsional</span>
        <textarea
          name="note"
          maxLength={1000}
          defaultValue={replacement?.note ?? ""}
          placeholder="Misalnya, keterangan saat melakukan pengukuran."
        />
        <small>Maksimal 1.000 karakter.</small>
      </label>
      <p className="notice">
        Status belum dievaluasi. Catatan ini tidak memicu pemberitahuan medis.
      </p>
      <button className="button primary" disabled={busy}>
        {busy
          ? "Menyimpan…"
          : replacement
            ? "Simpan catatan pengganti"
            : "Simpan catatan"}
      </button>
    </form>
  );
}
