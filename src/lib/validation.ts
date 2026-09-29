export type FieldLike = {
  type: string;
  validity: ValidityState;
  minLength?: number;
  min?: string;
};

// Pesan validasi berbahasa Indonesia; tooltip bawaan browser mengikuti bahasa perangkat.
export function fieldMessage(el: FieldLike): string {
  const v = el.validity;
  if (v.valid) return "";
  if (v.valueMissing)
    return el.type === "checkbox"
      ? "Centang untuk melanjutkan."
      : el.type.startsWith("select")
        ? "Pilih salah satu."
        : "Wajib diisi.";
  if (v.typeMismatch && el.type === "email")
    return "Format email belum benar, contoh: nama@email.com.";
  if (v.tooShort) return `Minimal ${el.minLength} karakter.`;
  if (v.rangeOverflow)
    return el.type.includes("date")
      ? "Tidak boleh melebihi waktu saat ini."
      : "Nilai terlalu besar.";
  if (v.rangeUnderflow)
    return el.type === "number" ? "Nilai harus lebih dari 0." : "Nilai terlalu kecil.";
  if (v.badInput || v.stepMismatch) return "Masukkan angka yang valid.";
  return "Isian belum valid.";
}
