import { NextResponse } from "next/server";

export type FieldErrors = Record<string, string>;

export function success(data: unknown, status = 200, meta?: unknown) {
  return NextResponse.json(meta ? { data, meta } : { data }, { status });
}

export function failure(
  code: string,
  message: string,
  status: number,
  fieldErrors?: FieldErrors,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fieldErrors && { fieldErrors }),
        correlationId: crypto.randomUUID(),
      },
    },
    { status },
  );
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && key.length >= 8 && key.length <= 200 ? key : null;
}

export function safeDatabaseFailure(message = "Permintaan tidak dapat diproses.") {
  return failure("REQUEST_FAILED", message, 400);
}
