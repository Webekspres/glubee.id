import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = { title: "Admin Glubee" };

export default function Page() {
  return (
    <main id="main" className="container page">
      <AdminPanel />
    </main>
  );
}
