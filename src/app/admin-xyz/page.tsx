import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = { title: "Admin" };

export default function Page() {
  return (
    <main id="main" className="container page">
      <AdminPanel />
    </main>
  );
}
