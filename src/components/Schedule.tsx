"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  SCHEDULE_CATEGORIES,
  addDays,
  hasMedicineFields,
  weekDays,
  type ScheduleCategory,
} from "@/lib/domain/schedule";
import { api, type Profile, type Timezone } from "@/lib/ui";
import { ErrorMessage, Loading, Modal, PageHeading, useFieldErrors } from "./Ui";
import { Mascot } from "./Mascot";

// GLB-018 / FR-SCHEDULE-001: kalender mingguan sederhana. Tanpa tombol "Sudah dilakukan"
// dan tanpa pengulangan sampai BR-PEND-006 diputuskan klien.

type Schedule = {
  id: string;
  category: ScheduleCategory;
  title: string;
  medicine_name: string | null;
  dose_note: string | null;
  local_date: string;
  local_time: string;
  timezone_code: Timezone;
  active: boolean;
  schedule_occurrences: { due_at: string; state: string }[];
};

const dayLabel = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const time = (s: Schedule) => `${s.local_time.slice(0, 5).replace(":", ".")} ${s.timezone_code}`;
const upcoming = (s: Schedule) =>
  s.schedule_occurrences.some((o) => o.state === "pending" && new Date(o.due_at).valueOf() > Date.now());

export function ScheduleCalendar({ profile }: { profile: Profile }) {
  const zone = profile.timezone_code!;
  const [week, setWeek] = useState<string | null>(null),
    [view, setView] = useState<{ items: Schedule[]; week: string; today: string } | null>(null),
    [error, setError] = useState<unknown>(null),
    [editing, setEditing] = useState<Schedule | "new" | null>(null),
    [removing, setRemoving] = useState<Schedule | null>(null),
    [busy, setBusy] = useState(false);

  const [revision, setRevision] = useState(0);
  const load = () => setRevision((r) => r + 1);
  useEffect(() => {
    let ignore = false;
    api<Schedule[]>("/api/schedules" + (week ? `?week=${week}` : ""))
      .then((r) => {
        if (ignore) return;
        setError(null);
        setView({ items: r.data, week: r.meta!.week!, today: r.meta!.today! });
      })
      .catch((e) => !ignore && setError(e));
    return () => {
      ignore = true;
    };
  }, [week, revision]);

  async function mutate(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      await api(url, init);
      load();
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const days = view ? weekDays(view.week) : [];
  const thisWeek = view && days.includes(view.today);
  const range = (month: "long" | "short") =>
    `${dayLabel(days[0], { day: "numeric", month })} – ${dayLabel(days[6], { day: "numeric", month, year: "numeric" })}`;

  return (
    <>
      <PageHeading
        title="Jadwal"
        description={`Rencanakan pemeriksaan gula darah, obat, dan insulin. Semua waktu dalam ${zone}.`}
      >
        <div className="page-heading-aside">
          <button className="button primary" onClick={() => setEditing("new")}>
            + Tambah jadwal
          </button>
        </div>
      </PageHeading>

      <p className="notice schedule-notice">
        Pengingat otomatis untuk jadwal sedang disiapkan. Untuk saat ini, jadwal tampil di halaman ini.
      </p>
      <ErrorMessage error={error} />

      {!view ? (
        !error && <Loading label="Memuat jadwal" />
      ) : (
        <section className="panel schedule-week" aria-labelledby="week-range">
          <div className="week-nav">
            <h2 id="week-range" aria-live="polite">
              <span className="range-long">{range("long")}</span>
              <span className="range-short">{range("short")}</span>
            </h2>
            <button className="button quiet week-prev" onClick={() => setWeek(addDays(view.week, -7))}>
              <span>‹ <span className="range-long">Minggu s</span><span className="range-short">S</span>ebelumnya</span>
            </button>
            <button className="button quiet week-next" onClick={() => setWeek(addDays(view.week, 7))}>
              <span><span className="range-long">Minggu b</span><span className="range-short">B</span>erikutnya ›</span>
            </button>
          </div>
          {!thisWeek && (
            <p className="week-today">
              <button className="text-button" onClick={() => setWeek(null)}>
                Kembali ke minggu ini
              </button>
            </p>
          )}

          {view.items.length === 0 ? (
            <div className="empty">
              <Mascot width={110} pose="rest" />
              <h3>Belum ada jadwal minggu ini</h3>
              <p className="muted">Tambahkan jadwal pemeriksaan, obat, atau insulin.</p>
              <button className="button primary" onClick={() => setEditing("new")}>
                + Tambah jadwal
              </button>
            </div>
          ) : (
            <ol className="week-days">
              {days.map((day) => {
                const items = view.items.filter((s) => s.local_date === day);
                return (
                  <li key={day} className={day === view.today ? "week-day today" : "week-day"}>
                    <h3>
                      {dayLabel(day, { weekday: "long", day: "numeric", month: "short" })}
                      {day === view.today && <span className="badge">Hari ini</span>}
                    </h3>
                    {items.length === 0 ? (
                      <p className="small muted">Tidak ada jadwal</p>
                    ) : (
                      <ul className="schedule-items">
                        {items.map((s) => {
                          const future = upcoming(s);
                          return (
                            <li key={s.id} className={s.active && future ? "schedule-item" : "schedule-item dimmed"}>
                              <p className="schedule-time">{time(s)}</p>
                              <div className="schedule-body">
                                <p className="schedule-title">{s.title}</p>
                                <p className="small muted">
                                  {SCHEDULE_CATEGORIES[s.category]}
                                  {s.medicine_name && ` · ${s.medicine_name}`}
                                  {s.dose_note && ` · ${s.dose_note}`}
                                </p>
                                {(!future || !s.active) && (
                                  <p>
                                    <span className="badge muted-badge">{!future ? "Sudah lewat" : "Dijeda"}</span>
                                  </p>
                                )}
                              </div>
                              {future && (
                                <div className="actions schedule-actions">
                                  <button className="button quiet" disabled={busy} onClick={() => setEditing(s)}>
                                    Ubah<span className="sr-only"> {s.title}</span>
                                  </button>
                                  <button
                                    className="button quiet"
                                    disabled={busy}
                                    onClick={() =>
                                      mutate(`/api/schedules/${s.id}`, {
                                        method: "PATCH",
                                        body: JSON.stringify({ active: !s.active }),
                                      })
                                    }
                                  >
                                    {s.active ? "Jeda" : "Aktifkan"}
                                    <span className="sr-only"> {s.title}</span>
                                  </button>
                                  <button className="button quiet danger-text" disabled={busy} onClick={() => setRemoving(s)}>
                                    Hapus<span className="sr-only"> {s.title}</span>
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Tambah jadwal" : "Ubah jadwal"} busy={busy} onClose={() => setEditing(null)}>
          <ScheduleForm
            zone={zone}
            schedule={editing === "new" ? undefined : editing}
            today={view?.today}
            onBusy={setBusy}
            onSaved={(date) => {
              setEditing(null);
              // Pindah ke minggu jadwal yang baru disimpan agar langsung terlihat.
              if (view && !weekDays(view.week).includes(date)) setWeek(date);
              else load();
            }}
          />
        </Modal>
      )}

      {removing && (
        <Modal title="Hapus jadwal?" busy={busy} onClose={() => setRemoving(null)}>
          <p>
            <strong>{removing.title}</strong>, {dayLabel(removing.local_date, { weekday: "long", day: "numeric", month: "long" })}{" "}
            pukul {time(removing)}. Jadwal yang dihapus tidak dapat dikembalikan.
          </p>
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (await mutate(`/api/schedules/${removing.id}`, { method: "DELETE" })) setRemoving(null);
              }}
            >
              {busy ? "Menghapus…" : "Hapus jadwal"}
            </button>
            <button className="button" disabled={busy} onClick={() => setRemoving(null)}>
              Batal
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ScheduleForm({
  zone,
  schedule,
  today,
  onSaved,
  onBusy,
}: {
  zone: Timezone;
  schedule?: Schedule;
  today?: string;
  onSaved: (date: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [category, setCategory] = useState<ScheduleCategory>(schedule?.category ?? "glucose_check"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const v = useFieldErrors();
  const id = useId();
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const medicine = hasMedicineFields(category);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !v.check(e.currentTarget)) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const localDate = String(f.get("localDate"));
    const body = JSON.stringify({
      category,
      title: f.get("title"),
      localDate,
      localTime: f.get("localTime"),
      medicineName: medicine ? f.get("medicineName") : null,
      doseNote: medicine ? f.get("doseNote") : null,
    });
    try {
      if (schedule) {
        await api(`/api/schedules/${schedule.id}`, { method: "PATCH", body });
      } else {
        if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
        await api("/api/schedules", {
          method: "POST",
          body,
          headers: { "Idempotency-Key": attempt.current.key },
        });
      }
      onSaved(localDate);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form
      className="form"
      noValidate
      onSubmit={submit}
      onInput={(e) => v.clear(e.target)}
      onChange={(e) => v.clear(e.target)}
    >
      <ErrorMessage error={error} />
      <fieldset className="field choice-group">
        <legend>Jenis jadwal</legend>
        <div className="choice-grid">
          {Object.entries(SCHEDULE_CATEGORIES).map(([key, label]) => (
            <label className="choice" key={key}>
              <input
                type="radio"
                name="category"
                value={key}
                checked={category === key}
                onChange={() => setCategory(key as ScheduleCategory)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-title`}>Nama kegiatan</label>
        <input
          id={`${id}-title`}
          name="title"
          required
          maxLength={120}
          defaultValue={schedule?.title}
          placeholder={medicine ? "Misalnya, obat pagi" : "Misalnya, cek gula darah puasa"}
          {...v.field("title")}
        />
        {v.error("title")}
      </div>
      {medicine && (
        <div className="form-row">
          <div className="field">
            <label htmlFor={`${id}-medicine`}>
              Nama {category === "insulin" ? "insulin" : "obat"} <span className="muted small">Opsional</span>
            </label>
            <input id={`${id}-medicine`} name="medicineName" maxLength={120} defaultValue={schedule?.medicine_name ?? ""} />
          </div>
          <div className="field">
            <label htmlFor={`${id}-dose`}>
              Dosis atau catatan <span className="muted small">Opsional</span>
            </label>
            <input id={`${id}-dose`} name="doseNote" maxLength={200} defaultValue={schedule?.dose_note ?? ""} />
          </div>
        </div>
      )}
      {medicine && (
        <p className="small muted">Tulis sesuai anjuran tenaga kesehatan Anda. Glubee tidak memberi saran obat atau dosis.</p>
      )}
      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-date`}>Tanggal</label>
          <input
            id={`${id}-date`}
            name="localDate"
            type="date"
            required
            min={today}
            defaultValue={schedule?.local_date ?? today}
            {...v.field("localDate")}
          />
          {v.error("localDate")}
        </div>
        <div className="field">
          <label htmlFor={`${id}-time`}>Jam ({zone})</label>
          <input
            id={`${id}-time`}
            name="localTime"
            type="time"
            required
            defaultValue={schedule?.local_time.slice(0, 5)}
            {...v.field("localTime")}
          />
          {v.error("localTime")}
        </div>
      </div>
      <div className="actions">
        <button className="button primary" disabled={busy}>
          {busy ? "Menyimpan…" : schedule ? "Simpan perubahan" : "Simpan jadwal"}
        </button>
      </div>
    </form>
  );
}
