"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import {
  CONTEXT_LABELS,
  api,
  localInput,
  localToUtc,
  type Entry,
  type Timezone,
} from "@/lib/ui";
import { ErrorMessage, useFieldErrors } from "./Ui";
import { HexIcon } from "./Icons";

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

  const v = useFieldErrors();
  const id = useId();
  const attempt = useRef<{ body: string; key: string } | null>(null);

  const refreshMax = () => {
    setMaxTime(localInput(new Date(), zone));
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !v.check(e.currentTarget)) return;
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
    <form
      className="form"
      noValidate
      onSubmit={submit}
      onInput={(e) => v.clear(e.target)}
      onChange={(e) => v.clear(e.target)}
    >
      <ErrorMessage error={error} />
      {replacement && (
        <p className="notice">
          Catatan pengganti akan ditautkan ke catatan lama yang telah ditandai
          salah.
        </p>
      )}
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-value`}>Hasil pengukuran</label>
          <input
            id={`${id}-value`}
            name="originalValue"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            required
            defaultValue={replacement?.original_value}
            {...v.field("originalValue")}
          />
          {v.error("originalValue")}
        </div>
        {/* Dua tombol bersebelahan: satu ketukan, tanpa daftar dropdown sistem. */}
        <fieldset className="field choice-group">
          <legend>Satuan</legend>
          <div className="choice-row">
            {["mg/dL", "mmol/L"].map((unit) => (
              <label className="choice" key={unit}>
                <input
                  type="radio"
                  name="originalUnit"
                  value={unit}
                  defaultChecked={
                    (replacement?.original_unit ?? "mg/dL") === unit
                  }
                />
                <span>{unit}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {/* Kondisi sebagai tombol besar dengan ikon sel madu yang sama seperti di riwayat,
          supaya pengguna lansia tidak perlu membuka dan menggulir dropdown. */}
      <fieldset
        className="field choice-group"
        aria-describedby={`${id}-context-hint`}
      >
        <legend>Kondisi pengukuran</legend>
        <div className="choice-grid">
          {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
            <label className="choice has-icon" key={key}>
              <input
                type="radio"
                name="measurementContext"
                value={key}
                required
                defaultChecked={replacement?.measurement_context === key}
                {...v.field("measurementContext", `${id}-context-hint`)}
              />
              <HexIcon name={key} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {v.error("measurementContext")}
        <small id={`${id}-context-hint`}>
          Puasa: tanpa asupan kalori minimal 8 jam. Setelah makan: 2 jam setelah
          makan.
        </small>
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-time`}>Waktu pengukuran ({zone})</label>
        <input
          id={`${id}-time`}
          name="measuredAt"
          type="datetime-local"
          defaultValue={time}
          max={maxTime}
          onFocus={refreshMax}
          onClick={refreshMax}
          required
          {...v.field("measuredAt", `${id}-time-hint`)}
        />
        {v.error("measuredAt")}
        <small id={`${id}-time-hint`}>
          Gunakan waktu pengukuran sebenarnya (maksimal waktu saat ini),
          termasuk untuk catatan sebelumnya.
        </small>
      </div>
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
