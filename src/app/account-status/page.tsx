"use client";
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
                ? "Akun Anda sedang dinonaktifkan. Hubungi pengelola untuk bantuan."
                : profile.account_status === "deletion_pending"
                  ? "Akun berada dalam masa jeda penghapusan. Fitur pengelolaan permintaan dan ekspor akun akan tersedia pada Sprint 3."
                  : "Silakan lanjutkan sesuai status akun Anda."}
            </p>
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
