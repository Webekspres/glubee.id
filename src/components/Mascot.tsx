import Image from "next/image";
import type { ReactNode } from "react";

// Netral: aset klien 30 Sep 2026. Pose lain: dibuat 5 Okt 2026 dengan ChatGPT dari
// maskot klien (docs/design/ASSET_PROMPTS.md), di-trim ke tinggi 480 px.
// Ekspresi status (safe/high/low/danger) disimpan untuk evaluasi nilai (GLB-P01)
// dan belum dipakai selama fitur itu nonaktif. Pose tidak boleh dipakai sebagai
// reaksi terhadap nilai gula darah, hanya terhadap keadaan layar atau tindakan.
const POSES = {
  neutral: { src: "/brand/mascot.webp", w: 356, h: 420 },
  wave: { src: "/brand/mascot-wave.webp", w: 389, h: 480 },
  point: { src: "/brand/mascot-point.webp", w: 448, h: 480 },
  report: { src: "/brand/mascot-report.webp", w: 372, h: 480 },
  cheer: { src: "/brand/mascot-cheer.webp", w: 426, h: 480 },
  search: { src: "/brand/mascot-search.webp", w: 388, h: 480 },
  rest: { src: "/brand/mascot-rest.webp", w: 452, h: 480 },
  display: { src: "/brand/mascot-display.webp", w: 380, h: 480 },
} as const;

export type MascotPose = keyof typeof POSES;

export function Mascot({
  width,
  pose = "neutral",
  className = "",
  priority = false,
}: {
  width: number;
  pose?: MascotPose;
  className?: string;
  priority?: boolean;
}) {
  const p = POSES[pose];
  return (
    <Image
      className={"mascot " + className}
      src={p.src}
      alt=""
      width={width}
      height={Math.round((width * p.h) / p.w)}
      priority={priority}
    />
  );
}

// Maskot memegang layar kosong: isinya ditulis kode sehingga angka selalu benar.
// Posisi layar diukur dari mascot-display.webp (kiri 18,9%, atas 53,8%, 62,1% × 21,2%).
export function MascotDisplay({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="mascot-display" style={{ maxWidth: width }}>
      <Mascot width={width} pose="display" />
      <div className="mascot-display-screen">{children}</div>
    </div>
  );
}
