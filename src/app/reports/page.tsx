"use client";
import { SessionGate } from "@/components/SessionGate";
import { ReportForm } from "@/components/ReportForm";
export default function Page() {
  return (
    <main id="main" className="container page">
      <SessionGate>{(profile) => <ReportForm profile={profile} />}</SessionGate>
    </main>
  );
}
