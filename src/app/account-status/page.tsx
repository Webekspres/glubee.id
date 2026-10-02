"use client";
import { AccountDeletion, DeletionSchedule } from "@/components/AccountDeletion";
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
                  ? "Akun berada dalam masa jeda penghapusan. Pencatatan dan pengingat dihentikan. Anda masih dapat mengunduh salinan data, membatalkan, atau keluar."
                  : "Silakan lanjutkan sesuai status akun Anda."}
            </p>
            {profile.account_status === "deletion_pending" && (
              <DeletionSchedule zone={profile.timezone_code ?? "WIB"} />
            )}
            {["suspended", "deletion_pending"].includes(profile.account_status) && (
              <ExportData />
            )}
            {profile.account_status === "deletion_pending" && (
              <AccountDeletion mode="cancel" zone={profile.timezone_code ?? "WIB"} />
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
