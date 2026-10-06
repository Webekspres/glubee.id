import { ZONES, type Timezone } from "@/lib/ui";

// GLB-018 / FR-SCHEDULE-001. Pengulangan dan status selesai menunggu BR-PEND-006.
export const SCHEDULE_CATEGORIES = {
  glucose_check: "Pemeriksaan gula darah",
  medicine: "Obat",
  insulin: "Insulin",
  other: "Lainnya",
} as const;
export type ScheduleCategory = keyof typeof SCHEDULE_CATEGORIES;

export type ScheduleInput = {
  category: ScheduleCategory;
  title: string;
  localDate: string;
  localTime: string;
  medicineName: string | null;
  doseNote: string | null;
};

export function hasMedicineFields(category: string) {
  return category === "medicine" || category === "insulin";
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

// Batas waktu (harus di masa depan, maksimal setahun) diperiksa database dengan zona profil.
export function validateScheduleInput(value: unknown) {
  const input = (value ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const category = input.category as ScheduleCategory;
  const title = text(input.title);
  const localDate = input.localDate;
  const localTime = input.localTime;
  const medicine = hasMedicineFields(category);
  const medicineName = medicine ? text(input.medicineName) || null : null;
  const doseNote = medicine ? text(input.doseNote) || null : null;

  if (!(category in SCHEDULE_CATEGORIES)) errors.category = "Pilih jenis jadwal.";
  if (!title) errors.title = "Isi nama kegiatan.";
  else if (title.length > 120) errors.title = "Nama kegiatan maksimal 120 karakter.";
  if (!isDate(localDate)) errors.localDate = "Tanggal tidak valid.";
  if (typeof localTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime))
    errors.localTime = "Jam tidak valid.";
  if (medicineName && medicineName.length > 120)
    errors.medicineName = "Nama obat maksimal 120 karakter.";
  if (doseNote && doseNote.length > 200) errors.doseNote = "Dosis atau catatan maksimal 200 karakter.";

  return {
    data: Object.keys(errors).length
      ? null
      : ({ category, title, localDate, localTime, medicineName, doseNote } as ScheduleInput),
    errors,
  };
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIn(zone: Timezone, now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONES[zone] }).format(now);
}

// Minggu dimulai Senin, seperti kalender Indonesia pada umumnya.
export function weekStart(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function weekDays(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Pesan untuk kode error dari RPC jadwal.
export function scheduleErrorMessage(message: string | undefined) {
  if (message?.includes("schedule_in_past")) return "Waktu jadwal harus setelah saat ini.";
  if (message?.includes("schedule_too_far")) return "Jadwal maksimal satu tahun ke depan.";
  if (message?.includes("schedule_not_upcoming")) return "Jadwal yang sudah lewat tidak dapat diubah.";
  if (message?.includes("schedule_not_found")) return "Jadwal tidak ditemukan.";
  if (message?.includes("schedule_limit_reached"))
    return "Batas 200 jadwal mendatang tercapai. Hapus jadwal yang tidak diperlukan.";
  return "Jadwal belum dapat disimpan.";
}
