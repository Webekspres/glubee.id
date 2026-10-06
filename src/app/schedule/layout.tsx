import type { Metadata } from "next";

// Halaman ini client component, jadi judul tab ditetapkan di sini.
export const metadata: Metadata = { title: "Jadwal" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
