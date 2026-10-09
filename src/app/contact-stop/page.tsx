import type { Metadata } from "next";
import { ContactStop } from "@/components/ContactStop";

export const metadata: Metadata = { title: "Berhenti menjadi kontak darurat", robots: { index: false } };

export default function Page() {
  return (
    <main id="main" className="container page">
      <div className="narrow">
        <ContactStop />
      </div>
    </main>
  );
}
