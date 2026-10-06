import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, idempotencyKey, readJson, success } from "@/lib/api";
import {
  addDays,
  isDate,
  scheduleErrorMessage,
  todayIn,
  validateScheduleInput,
  weekStart,
} from "@/lib/domain/schedule";
import type { Timezone } from "@/lib/ui";

// GLB-018 / FR-SCHEDULE-001: daftar jadwal satu minggu (Senin-Minggu) dan buat jadwal baru.

const SCHEDULE_COLUMNS =
  "id,category,title,medicine_name,dose_note,local_date,local_time,timezone_code,active,schedule_occurrences(due_at,state)";

export async function GET(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "schedule.read", 120))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const { data: profile } = await auth.supabase.from("profiles").select("timezone_code").single();
  const zone = profile?.timezone_code as Timezone | undefined;
  if (!zone) return failure("PROFILE_REQUIRED", "Lengkapi profil terlebih dahulu.", 409);

  const week = new URL(request.url).searchParams.get("week");
  if (week && !isDate(week)) return failure("INVALID_RANGE", "Minggu tidak valid.", 400);
  const monday = weekStart(week ?? todayIn(zone));
  const { data, error } = await auth.supabase
    .from("schedules")
    .select(SCHEDULE_COLUMNS)
    .gte("local_date", monday)
    .lte("local_date", addDays(monday, 6))
    .order("local_date")
    .order("local_time");
  if (error) return failure("REQUEST_FAILED", "Jadwal belum dapat dimuat.", 400);
  return success(data ?? [], 200, { week: monday, today: todayIn(zone), timezone: zone });
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "schedule.write", 30))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const key = idempotencyKey(request);
  if (!key) return failure("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key wajib diisi.", 400);
  const validated = validateScheduleInput(await readJson(request));
  if (!validated.data)
    return failure("VALIDATION_ERROR", "Periksa kembali jadwal.", 422, validated.errors);
  const s = validated.data;
  const { data, error } = await auth.supabase.rpc("create_schedule", {
    p_idempotency_key: key,
    p_category: s.category,
    p_title: s.title,
    p_local_date: s.localDate,
    p_local_time: s.localTime,
    p_medicine_name: s.medicineName,
    p_dose_note: s.doseNote,
  });
  return error ? failure("REQUEST_FAILED", scheduleErrorMessage(error.message), 400) : success(data, 201);
}
