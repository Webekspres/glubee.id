const CONTEXTS = ["fasting", "before_meal", "after_meal", "random", "other"] as const;
const TIMEZONE_OFFSET_MINUTES = { WIB: 420, WITA: 480, WIT: 540 } as const;

export type GlucoseInput = {
  originalValue: number;
  originalUnit: "mg/dL" | "mmol/L";
  measurementContext: (typeof CONTEXTS)[number];
  measuredAt: string;
  note: string | null;
};

export function toMgDl(value: number, unit: GlucoseInput["originalUnit"]) {
  return unit === "mg/dL" ? value : Math.round(value * 18_000) / 1_000;
}

export function validateGlucoseInput(value: unknown, now = new Date()) {
  const input = value as Partial<GlucoseInput> | null;
  const errors: Record<string, string> = {};
  const originalValue = Number(input?.originalValue);
  const originalUnit = input?.originalUnit;
  const measurementContext = input?.measurementContext;
  const measuredAt = typeof input?.measuredAt === "string" ? input.measuredAt : "";
  const note = typeof input?.note === "string" ? input.note.trim() || null : null;
  const measuredDate = new Date(measuredAt);

  if (!Number.isFinite(originalValue) || originalValue <= 0 || Math.abs(Math.round(originalValue * 1000) - originalValue * 1000) > 1e-9) {
    errors.originalValue = "Nilai harus positif dengan maksimal tiga angka desimal.";
  }
  if (originalUnit !== "mg/dL" && originalUnit !== "mmol/L") errors.originalUnit = "Satuan tidak valid.";
  if (!CONTEXTS.includes(measurementContext as never)) errors.measurementContext = "Kondisi pengukuran tidak valid.";
  if (Number.isNaN(measuredDate.valueOf()) || measuredDate.valueOf() > now.valueOf() + 5 * 60_000) {
    errors.measuredAt = "Waktu pengukuran tidak valid atau terlalu jauh di masa depan.";
  }
  if (note && note.length > 1000) errors.note = "Catatan maksimal 1000 karakter.";

  return {
    data: Object.keys(errors).length
      ? null
      : ({ originalValue, originalUnit, measurementContext, measuredAt: measuredDate.toISOString(), note } as GlucoseInput),
    errors,
  };
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function zonedDate(now: Date, offsetMinutes: number) {
  return new Date(now.valueOf() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

function utcBoundary(localDate: string, offsetMinutes: number) {
  return new Date(`${localDate}T00:00:00.000Z`).valueOf() - offsetMinutes * 60_000;
}

export function resolveRange(
  params: URLSearchParams,
  timezoneCode: keyof typeof TIMEZONE_OFFSET_MINUTES,
  now = new Date(),
) {
  const offset = TIMEZONE_OFFSET_MINUTES[timezoneCode];
  const period = params.get("period");
  let from = params.get("from");
  let to = params.get("to");

  if (period && ["7", "14", "30"].includes(period)) {
    to = zonedDate(now, offset);
    const start = new Date(`${to}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - Number(period) + 1);
    from = start.toISOString().slice(0, 10);
  }
  if (!from || !to || !dateOnly(from) || !dateOnly(to) || from > to) return null;

  const afterTo = new Date(`${to}T00:00:00.000Z`);
  afterTo.setUTCDate(afterTo.getUTCDate() + 1);
  return {
    from: new Date(utcBoundary(from, offset)).toISOString(),
    toExclusive: new Date(utcBoundary(afterTo.toISOString().slice(0, 10), offset)).toISOString(),
  };
}

export function encodeCursor(measuredAt: string, id: string) {
  return Buffer.from(JSON.stringify([measuredAt, id])).toString("base64url");
}

export function decodeCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString()) as unknown;
    if (!Array.isArray(value) || value.length !== 2 || value.some((item) => typeof item !== "string")) return null;
    if (Number.isNaN(new Date(value[0]).valueOf()) || !/^[0-9a-f-]{36}$/i.test(value[1])) return null;
    return { measuredAt: value[0], id: value[1] };
  } catch {
    return null;
  }
}

export function glucoseSummary(entries: Array<{
  normalized_mg_dl: number | string;
  original_value: number | string;
  original_unit: string;
  measurement_context: string;
  measured_at: string;
}>) {
  if (!entries.length) return { count: 0, minimumMgDl: null, maximumMgDl: null, averageMgDl: null, points: [] };
  const values = entries.map((entry) => Number(entry.normalized_mg_dl));
  return {
    count: values.length,
    minimumMgDl: Math.min(...values),
    maximumMgDl: Math.max(...values),
    averageMgDl: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1000) / 1000,
    points: entries.map((entry) => ({
      measuredAt: entry.measured_at,
      valueMgDl: Number(entry.normalized_mg_dl),
      originalValue: Number(entry.original_value),
      originalUnit: entry.original_unit,
      measurementContext: entry.measurement_context,
    })),
  };
}
