import type { Metadata } from "next";
import { ContactInvitation } from "@/components/ContactInvitation";

export const metadata: Metadata = { title: "Undangan kontak darurat", robots: { index: false } };

export default function Page() {
  return (
    <main id="main" className="container page">
      <div className="narrow">
        <ContactInvitation />
      </div>
    </main>
  );
}
