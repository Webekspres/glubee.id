import { APP_CONFIG } from "@/lib/config";

export type ProfileInput = {
  name: string;
  birthDate: string;
  sex: "female" | "male";
  timezoneCode: (typeof APP_CONFIG.supportedTimezones)[number];
};

function validDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function isAdult(birthDate: string, now = new Date()) {
  if (!validDateOnly(birthDate)) return false;
  const eighteenthBirthday = new Date(`${birthDate}T00:00:00.000Z`);
  eighteenthBirthday.setUTCFullYear(eighteenthBirthday.getUTCFullYear() + 18);
  const jakartaNow = new Date(now.valueOf() + 7 * 60 * 60_000);
  const today = Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth(), jakartaNow.getUTCDate());
  return eighteenthBirthday.valueOf() <= today;
}

export function validateProfile(value: unknown, now = new Date()) {
  const input = value as Partial<ProfileInput> | null;
  const errors: Record<string, string> = {};
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const birthDate = typeof input?.birthDate === "string" ? input.birthDate : "";
  const sex = input?.sex;
  const timezoneCode = input?.timezoneCode;

  if (name.length < 1 || name.length > 120) errors.name = "Nama wajib diisi (maksimal 120 karakter).";
  if (!isAdult(birthDate, now)) errors.birthDate = "Pengguna harus berusia minimal 18 tahun.";
  if (sex !== "female" && sex !== "male") errors.sex = "Jenis kelamin tidak valid.";
  if (!APP_CONFIG.supportedTimezones.includes(timezoneCode as never)) {
    errors.timezoneCode = "Zona waktu harus WIB, WITA, atau WIT.";
  }

  return {
    data: Object.keys(errors).length
      ? null
      : ({ name, birthDate, sex, timezoneCode } as ProfileInput),
    errors,
  };
}
