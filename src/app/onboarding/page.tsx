"use client";
import { SessionGate } from "@/components/SessionGate";
import { ProfileForm } from "@/components/ProfileForm";
import { PageHeading } from "@/components/Ui";
export default function Page() {
  return (
    <main id="main" className="container page">
      <div className="narrow">
        <PageHeading eyebrow="Satu langkah lagi" title="Kenali profil Anda" />
        <SessionGate onboarding={true}>
          {(profile) => <ProfileForm profile={profile} onboarding={true} />}
        </SessionGate>
      </div>
    </main>
  );
}
