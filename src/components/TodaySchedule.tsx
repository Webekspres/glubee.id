"use client";
import { useEffect, useState } from "react";
import { api, type Timezone } from "@/lib/ui";
import { TransitionLink as Link } from "./TransitionLink";

// GLB-020 / FR-REMINDER-001: pengingat dashboard. Selalu tersedia bagi pengguna aktif, tidak
// bergantung pada push/email; dibaca langsung dari jadwal hari ini.

type Item = {
  id: string;
  title: string;
  local_date: string;
  local_time: string;
  timezone_code: Timezone;
  active: boolean;
  schedule_occurrences: { due_at: string; state: string }[];
};

export function TodaySchedule() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let ignore = false;
    api<Item[]>("/api/schedules")
      .then((r) => !ignore && setItems(r.data.filter((s) => s.active && s.local_date === r.meta?.today)))
      .catch(() => !ignore && setItems([]));
    // Status "sudah lewat" ikut berganti tanpa memuat ulang halaman.
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      ignore = true;
      clearInterval(tick);
    };
  }, []);

  if (!items) return null;
  const due = (s: Item) => s.schedule_occurrences.some((o) => new Date(o.due_at).valueOf() <= now);

  return (
    <section className="panel today-schedule" aria-labelledby="today-schedule-title">
      <div className="section-heading">
        <h2 id="today-schedule-title">Jadwal hari ini</h2>
        <Link className="text-button" href="/schedule">
          {items.length ? "Lihat semua" : "Atur jadwal"}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="muted small">Tidak ada jadwal untuk hari ini.</p>
      ) : (
        <ul className="today-schedule-list">
          {items.map((s) => (
            <li key={s.id} className={due(s) ? "is-due" : undefined}>
              <time>{`${s.local_time.slice(0, 5).replace(":", ".")} ${s.timezone_code}`}</time>
              <span className="today-schedule-title">{s.title}</span>
              <span className="today-schedule-state">{due(s) ? "Sudah tiba" : "Akan datang"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
