"use client";
import { TransitionLink as Link } from "./TransitionLink";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/ui";
import { fieldMessage } from "@/lib/validation";
import { Mascot } from "./Mascot";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Validasi inline: form memakai noValidate, check() dipanggil di awal submit.
export function useFieldErrors() {
  const prefix = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const id = (name: string) => `${prefix}-${name}-error`;
  function check(form: HTMLFormElement, extra: Record<string, string> = {}) {
    const found: Record<string, string> = {};
    let first: Control | null = null;
    for (const el of Array.from(form.elements) as Control[]) {
      if (!el.name || !("validity" in el)) continue;
      const message = fieldMessage(el as HTMLInputElement) || extra[el.name];
      if (message && !found[el.name]) {
        found[el.name] = message;
        first ??= el;
      }
    }
    setErrors(found);
    first?.focus();
    return !first;
  }
  function clear(target: EventTarget) {
    const el = target as Control;
    if (el.name && errors[el.name] && el.validity?.valid)
      setErrors((prev) => {
        const next = { ...prev };
        delete next[el.name];
        return next;
      });
  }
  const field = (name: string, hint?: string) =>
    errors[name]
      ? {
          "aria-invalid": true as const,
          "aria-describedby": [hint, id(name)].filter(Boolean).join(" "),
        }
      : { "aria-describedby": hint };
  const error = (name: string) =>
    errors[name] ? (
      <small className="field-error" id={id(name)}>
        {errors[name]}
      </small>
    ) : null;
  return { check, clear, field, error };
}
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="message error" role="alert">
      <p>
        {error instanceof Error
          ? error.message
          : "Permintaan belum dapat diproses."}
      </p>
      {error instanceof ApiError && (
        <>
          {Object.entries(error.fields).map(([key, value]) => (
            <p key={key}>{value}</p>
          ))}
          {error.status === 401 && (
            <Link href="/login" target="_blank">
              Masuk kembali di tab baru
            </Link>
          )}
        </>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="button quiet"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup dialog"
        >
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Indikator memuat: tiga sel madu menyala bergantian (motif maskot). Baru tampil
// setelah ~0,2 detik agar muatan cepat tidak berkedip; diam bila pengguna
// memilih kurangi gerakan.
export function Loading({ label, mascot = false }: { label: string; mascot?: boolean }) {
  return (
    <div className={"loader" + (mascot ? " is-page" : "")} role="status">
      {mascot && <Mascot width={96} className="loader-mascot" />}
      <span className="loader-cells" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <p>{label}</p>
    </div>
  );
}

// Tanggal lahir diketik sebagai hh/bb/tttt dengan papan angka. Date picker bawaan Android
// dibuka di bulan ini, sehingga pengguna lahir 1960 harus mundur puluhan tahun.
// Nilai ISO dikirim lewat input tersembunyi "birthDate".
function isoFromText(text: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return "";
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const date = new Date(iso + "T00:00:00.000Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}
function formatDigits(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
}
export function BirthDateInput({
  id,
  defaultValue = "",
  describedBy,
}: {
  id: string;
  defaultValue?: string;
  describedBy?: Record<string, unknown>;
}) {
  const [text, setText] = useState(() =>
    defaultValue ? defaultValue.split("-").reverse().join("/") : "",
  );
  const iso = isoFromText(text);
  return (
    <>
      <input
        id={id}
        name="birthDateText"
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="hh/bb/tttt"
        pattern="\d{2}/\d{2}/\d{4}"
        title="Format hh/bb/tttt, contoh 17/08/1960"
        maxLength={10}
        required
        value={text}
        onChange={(e) => {
          const next = formatDigits(e.target.value);
          setText(next);
          e.target.setCustomValidity(
            next.length === 10 && !isoFromText(next)
              ? "Tanggal ini tidak ada di kalender. Periksa tanggal dan bulan."
              : "",
          );
        }}
        {...describedBy}
      />
      <input type="hidden" name="birthDate" value={iso || text} />
    </>
  );
}
