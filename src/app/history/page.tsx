"use client";
import { SessionGate } from "@/components/SessionGate";
import { Records } from "@/components/Records";
export default function Page() {
  return (
    <main id="main" className="container page">
      <SessionGate>
        {(profile) => <Records profile={profile} history={true} />}
      </SessionGate>
    </main>
  );
}
