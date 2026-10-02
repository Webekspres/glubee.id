import { ZONES, type Timezone } from "@/lib/ui";

// Konfirmasi penghapusan menampilkan jadwal dalam zona pengguna dan UTC (GLB-024 AC).
export function deletionSchedule(scheduledFor: string, zone: Timezone) {
  const at = new Date(scheduledFor);
  const fmt = (timeZone: string, weekday: boolean) =>
    new Intl.DateTimeFormat("id-ID", {
      ...(weekday && { weekday: "long" as const }),
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    })
      .format(at)
      .replace(/(\d{4}),? (?:pukul )?/, "$1 pukul ");
  return { local: `${fmt(ZONES[zone], true)} ${zone}`, utc: `${fmt("UTC", false)} UTC` };
}
