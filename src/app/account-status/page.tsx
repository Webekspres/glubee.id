"use client";
import { ExportData } from "@/components/ExportData";
import { SessionGate } from "@/components/SessionGate";
import { accountDestination } from "@/lib/ui";
export default function Page() {
  return (
    <main id="main" className="container page">
      <SessionGate status>
        {(profile) => (
          <section className="panel narrow stack">
            <h1>Status akun</h1>
            <p>
              {profile.account_status === "suspended"
                ? "Akun Anda sedang dinonaktifkan. Hubungi pengelola untuk bantuan. Anda tetap dapat mengunduh salinan data Anda."
                : profile.account_status === "deletion_pending"
                  ? "Akun berada dalam masa jeda penghapusan. Anda masih dapat mengunduh salinan data sebelum akun dihapus."
                  : "Silakan lanjutkan sesuai status akun Anda."}
            </p>
            {["suspended", "deletion_pending"].includes(profile.account_status) && (
              <ExportData />
            )}
            <a href="/privacy">Kontak pengelola</a>
            {["active", "onboarding"].includes(profile.account_status) && (
              <a
                className="button"
                href={accountDestination(profile.account_status)}
              >
                Lanjutkan
              </a>
            )}
          </section>
        )}
      </SessionGate>
    </main>
  );
}
