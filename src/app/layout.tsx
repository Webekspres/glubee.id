import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Atkinson_Hyperlegible_Next, Fraunces, Titan_One } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";
import { appUrl } from "@/lib/config";

// Pengganti sementara font brand (Ellak, Morally Serif) sampai file berlisensi diterima.
const display = Titan_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});
const text = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  variable: "--font-text",
});
// Teks isi, label, dan angka kecil: Atkinson Hyperlegible dirancang untuk pembaca
// dengan penglihatan menurun (umum pada diabetes). Fraunces tetap untuk judul bagian.
const ui = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: "Glubee", template: "%s · Glubee" },
  description: "Pencatatan dan pemantauan gula darah.",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Glubee",
    title: "Glubee",
    description:
      "Catat gula darah, lihat perjalanannya, dan siapkan laporan untuk konsultasi.",
  },
};

export const viewport: Viewport = { themeColor: "#011B2F" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={[display.variable, text.variable, ui.variable].join(" ")}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
