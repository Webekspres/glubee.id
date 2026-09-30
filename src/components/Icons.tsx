import type { ReactNode } from "react";

// Ikon digambar sendiri (bukan emoji) agar tampil sama di Android, iOS, dan Windows.
// Garis tebal 2,2 px supaya tetap terbaca pada ukuran kecil.
const GLYPHS: Record<string, ReactNode> = {
  // Puasa: matahari terbit, pengukuran pagi sebelum makan.
  fasting: (
    <>
      <path d="M4 17h16" />
      <path d="M7.5 17a4.5 4.5 0 0 1 9 0" />
      <path d="M12 6.5v2M5.5 10l1.4 1.4M18.5 10l-1.4 1.4" />
    </>
  ),
  // Sebelum makan: piring kosong dan sendok.
  before_meal: (
    <>
      <circle cx="13.5" cy="12" r="6" />
      <circle cx="13.5" cy="12" r="2.6" />
      <path d="M4 5.5v13" />
    </>
  ),
  // Setelah makan: piring terisi dengan jam kecil (2 jam setelah makan).
  after_meal: (
    <>
      <path d="M3.5 14.5h13a6.5 6.5 0 0 1-13 0Z" />
      <circle cx="17.5" cy="7" r="3.5" />
      <path d="M17.5 5.4V7l1 .9" />
    </>
  ),
  // Sewaktu: tetes darah, pengukuran kapan saja.
  random: <path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10Z" />,
  other: (
    <>
      <path d="M6 4h9l3 3v13H6Z" />
      <path d="M9 11h6M9 15h4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.6v.4" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  report: (
    <>
      <path d="M6 3.5h8l4 4v13H6Z" />
      <path d="M9 16.5v-2M12 16.5v-5M15 16.5v-3" />
    </>
  ),
};

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg
      className={"icon " + className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name] ?? GLYPHS.other}
    </svg>
  );
}

// Ikon dalam sel heksagon: motif sel madu maskot, dipakai untuk kondisi pengukuran.
export function HexIcon({ name }: { name: string }) {
  return (
    <span className="hex-icon" aria-hidden="true">
      <Icon name={name} />
    </span>
  );
}
