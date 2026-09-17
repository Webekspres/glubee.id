import type { GlucoseInput } from "./domain/glucose";
export type Timezone = "WIB" | "WITA" | "WIT";
export const ZONES = {
  WIB: "Asia/Jakarta",
  WITA: "Asia/Makassar",
  WIT: "Asia/Jayapura",
} as const;
const OFFSETS = { WIB: "+07:00", WITA: "+08:00", WIT: "+09:00" } as const;
export const CONTEXT_LABELS: Record<
  GlucoseInput["measurementContext"],
  string
> = {
  fasting: "Puasa",
  before_meal: "Sebelum makan",
  after_meal: "2 jam setelah makan",
  random: "Sewaktu",
  other: "Lainnya",
};
export type Profile = {
  name: string | null;
  birth_date: string | null;
  sex: "female" | "male" | null;
  timezone_code: Timezone | null;
  account_status: string;
};
export type Entry = {
  id: string;
  original_value: number;
  original_unit: GlucoseInput["originalUnit"];
  normalized_mg_dl: number;
  measurement_context: GlucoseInput["measurementContext"];
  measured_at: string;
  recorded_at: string;
  note: string | null;
  status: "valid" | "invalid";
  invalidated_at: string | null;
  invalidation_reason: string | null;
  replacement_for_id: string | null;
};
export type Receipt = {
  id: string;
  consent_type: string;
  document_version: string;
  decision: string;
  recorded_at: string;
  method: string;
};
export type Point = {
  measuredAt: string;
  valueMgDl: number;
  originalValue: number;
  originalUnit: string;
  measurementContext: string;
};
export function numberText(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(
        value,
      );
}
export function dateTime(value: string, zone: Timezone) {
  return (
    new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: ZONES[zone],
    }).format(new Date(value)) +
    " " +
    zone
  );
}
export function localInput(value: Date, zone: Timezone) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONES[zone],
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(value)
    .replace(" ", "T");
}
export function localToUtc(value: string, zone: Timezone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value + ":00" + OFFSETS[zone]);
  return Number.isNaN(date.valueOf()) || localInput(date, zone) !== value
    ? null
    : date.toISOString();
}
export function accountDestination(status: string | null) {
  return status === "active"
    ? "/dashboard"
    : status === "onboarding"
      ? "/onboarding"
      : "/account-status";
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  url: string,
  options?: RequestInit,
): Promise<{
  data: T;
  meta?: { nextCursor?: string | null; timezone?: Timezone };
}> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new ApiError(
      "Koneksi terputus. Input Anda tetap tersimpan di halaman ini; silakan coba lagi.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status === 401
        ? "Sesi berakhir atau akun belum terverifikasi. Silakan masuk kembali."
        : (body?.error?.message ?? "Layanan belum dapat dihubungi. Coba lagi."),
      response.status,
      body?.error?.fieldErrors,
    );
  return body;
}
