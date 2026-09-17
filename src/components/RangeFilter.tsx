"use client";
import { useState, type FormEvent } from "react";
import { localInput, type Timezone } from "@/lib/ui";

export function RangeFilter({
  onChange,
  initial = "7",
  zone = "WIB",
}: {
  onChange: (query: string) => void;
  initial?: string;
  zone?: Timezone;
}) {
  const [period, setPeriod] = useState(initial),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");

  const today = localInput(new Date(), zone).slice(0, 10);

  function choose(value: string) {
    setPeriod(value);
    onChange(value === "custom" ? "" : "period=" + value);
  }

  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (from > today || to > today) return;
    onChange(new URLSearchParams({ from, to }).toString());
  }

  return (
    <div className="stack">
      <div className="filters" role="group" aria-label="Periode catatan">
        {[
          ["7", "7 hari"],
          ["14", "14 hari"],
          ["30", "30 hari"],
          ["current_month", "Bulan ini"],
          ["custom", "Rentang tanggal"],
        ].map(([value, label]) => (
          <button
            key={value}
            className="button"
            aria-pressed={period === value}
            onClick={() => choose(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <form className="filters" onSubmit={apply}>
          <label className="field">
            Dari tanggal
            <input
              type="date"
              required
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                onChange("");
              }}
              max={to || today}
            />
          </label>
          <label className="field">
            Sampai tanggal
            <input
              type="date"
              required
              value={to}
              min={from || undefined}
              max={today}
              onChange={(e) => {
                setTo(e.target.value);
                onChange("");
              }}
            />
          </label>
          <button className="button primary">Terapkan</button>
        </form>
      )}
    </div>
  );
}
