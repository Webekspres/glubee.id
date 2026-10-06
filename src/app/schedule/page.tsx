"use client";
import { SessionGate } from "@/components/SessionGate";
import { ScheduleCalendar } from "@/components/Schedule";
export default function Page() {
  return (
    <main id="main" className="container page">
      <SessionGate>{(profile) => <ScheduleCalendar profile={profile} />}</SessionGate>
    </main>
  );
}
