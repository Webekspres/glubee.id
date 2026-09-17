"use client";
import { SessionGate } from "@/components/SessionGate";
import { ProfileForm } from "@/components/ProfileForm";
import { PageHeading } from "@/components/Ui";
export default function Page() {
  return (
    <main id="main" className="container page">
      <div className="narrow">
        <PageHeading eyebrow="Akun Anda" title="Profil & privasi" />
        <SessionGate onboarding={false}>
          {(profile) => <ProfileForm profile={profile} onboarding={false} />}
        </SessionGate>
      </div>
    </main>
  );
}
