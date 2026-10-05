import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Pratinjau tautan (WhatsApp dan lainnya). Ilustrasi: og-illustration dari
// docs/design/ASSET_PROMPTS.md (B3), dipotong ke 1200 × 630; teks ditulis di sini.
// Font: Liberation Sans (sudah dipakai PDF) karena file Titan One tidak tersedia
// untuk renderer ini; ganti bila font brand berlisensi diterima.
export const alt =
  "Maskot Glubee melambai di samping tulisan: Setiap catatan, satu langkah lebih terarah.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [base, font] = await Promise.all([
    readFile(join(process.cwd(), "assets/brand/og-base.jpg")),
    readFile(join(process.cwd(), "assets/fonts/LiberationSans-Regular.ttf")),
  ]);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative" }}>
        <img
          src={`data:image/jpeg;base64,${base.toString("base64")}`}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", inset: 0 }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 0 80px",
            width: 640,
            height: "100%",
            fontFamily: "Liberation Sans",
          }}
        >
          <div style={{ fontSize: 40, color: "#88BBAA", marginBottom: 20 }}>Glubee</div>
          <div style={{ fontSize: 64, lineHeight: 1.1, color: "#FFD358" }}>
            Setiap catatan, satu langkah lebih terarah.
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.4, color: "#EAF3F1", marginTop: 28 }}>
            Catat gula darah, lihat perjalanannya, dan siapkan laporan untuk konsultasi.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Liberation Sans", data: font, style: "normal", weight: 400 }] },
  );
}
