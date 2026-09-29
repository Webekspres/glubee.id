import { expect, test } from "bun:test";
import { fieldMessage, type FieldLike } from "./validation";

const field = (validity: Partial<ValidityState>, extra: Partial<FieldLike> = {}): FieldLike => ({
  type: "text",
  validity: { valid: false, ...validity } as ValidityState,
  ...extra,
});

test("required fields use Indonesian messages per input type", () => {
  expect(fieldMessage(field({ valueMissing: true }))).toBe("Wajib diisi.");
  expect(fieldMessage(field({ valueMissing: true }, { type: "checkbox" }))).toBe("Centang untuk melanjutkan.");
  expect(fieldMessage(field({ valueMissing: true }, { type: "select-one" }))).toBe("Pilih salah satu.");
});

test("format and range messages include the limit", () => {
  expect(fieldMessage(field({ typeMismatch: true }, { type: "email" }))).toBe("Format email belum benar, contoh: nama@email.com.");
  expect(fieldMessage(field({ tooShort: true }, { minLength: 8 }))).toBe("Minimal 8 karakter.");
  expect(fieldMessage(field({ rangeOverflow: true }, { type: "datetime-local" }))).toBe("Tidak boleh melebihi waktu saat ini.");
  expect(fieldMessage(field({ rangeUnderflow: true }, { type: "number", min: "0.001" }))).toBe("Nilai harus lebih dari 0.");
});

test("valid fields have no message", () => {
  expect(fieldMessage({ type: "text", validity: { valid: true } as ValidityState })).toBe("");
});
