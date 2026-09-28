import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Titan_One } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";

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

export const metadata: Metadata = {
  title: "Glubee",
  description: "Pencatatan dan pemantauan gula darah.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={display.variable + " " + text.variable}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
