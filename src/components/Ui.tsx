"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { ApiError } from "@/lib/ui";
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
