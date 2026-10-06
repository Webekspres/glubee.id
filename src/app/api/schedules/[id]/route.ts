import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { scheduleErrorMessage, validateScheduleInput } from "@/lib/domain/schedule";

// GLB-018: ubah, jeda/aktifkan (`{ active }`), dan hapus jadwal mendatang milik sendiri.

async function prepare(context: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedRequest();
  if (auth.response) return { response: auth.response } as const;
  if (await rateLimited(auth.supabase, "schedule.write", 30))
    return { response: failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429) } as const;
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return { response: failure("INVALID_ID", "ID jadwal tidak valid.", 400) } as const;
  return { response: null, supabase: auth.supabase, id } as const;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await prepare(context);
  if (ctx.response) return ctx.response;
  const body = objectValue(await readJson(request));
  if (typeof body?.active === "boolean" && Object.keys(body).length === 1) {
    const { data, error } = await ctx.supabase.rpc("set_schedule_active", {
      p_schedule_id: ctx.id,
      p_active: body.active,
    });
    return error ? failure("REQUEST_FAILED", scheduleErrorMessage(error.message), 400) : success(data);
  }
  const validated = validateScheduleInput(body);
  if (!validated.data)
    return failure("VALIDATION_ERROR", "Periksa kembali jadwal.", 422, validated.errors);
  const s = validated.data;
  const { data, error } = await ctx.supabase.rpc("update_schedule", {
    p_schedule_id: ctx.id,
    p_category: s.category,
    p_title: s.title,
    p_local_date: s.localDate,
    p_local_time: s.localTime,
    p_medicine_name: s.medicineName,
    p_dose_note: s.doseNote,
  });
  return error ? failure("REQUEST_FAILED", scheduleErrorMessage(error.message), 400) : success(data);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await prepare(context);
  if (ctx.response) return ctx.response;
  const { error } = await ctx.supabase.rpc("delete_schedule", { p_schedule_id: ctx.id });
  return error ? failure("REQUEST_FAILED", scheduleErrorMessage(error.message), 400) : success(null);
}
