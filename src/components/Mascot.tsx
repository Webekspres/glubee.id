import Image from "next/image";

// Aset klien 30 Sep 2026 (public/brand, 420 px tinggi). Ekspresi status (safe/high/low/danger)
// disimpan untuk evaluasi nilai (GLB-P01) dan belum dipakai selama fitur itu nonaktif.
export function Mascot({
  width,
  className = "",
  priority = false,
}: {
  width: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={"mascot " + className}
      src="/brand/mascot.webp"
      alt=""
      width={width}
      height={Math.round((width * 420) / 356)}
      priority={priority}
    />
  );
}
