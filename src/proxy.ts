import { NextResponse, type NextRequest } from "next/server";
export function proxy(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const sameOrigin =
      origin === new URL(request.url).origin ||
      origin === process.env.NEXT_PUBLIC_APP_URL;
    if (
      (origin && !sameOrigin) ||
      request.headers.get("sec-fetch-site") === "cross-site" ||
      !request.headers.get("content-type")?.startsWith("application/json")
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ORIGIN",
            message: "Permintaan harus berasal dari aplikasi Glubee.",
            correlationId: crypto.randomUUID(),
          },
        },
        { status: 403 },
      );
    }
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const config = { matcher: ["/api/:path*", "/auth/callback"] };
