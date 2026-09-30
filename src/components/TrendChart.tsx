"use client";
import { useState } from "react";
import {
  CONTEXT_LABELS,
  dateTime,
  numberText,
  type Point,
  type Timezone,
  ZONES,
} from "@/lib/ui";
import { Mascot } from "./Mascot";
import { timeTicks, valueAxis } from "@/lib/chart";
export function TrendChart({
  points,
  zone,
}: {
  points: Point[];
  zone: Timezone;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!points.length)
    return (
      <div className="empty">
        <Mascot width={88} />
        <h3>Belum ada catatan pada periode ini</h3>
        <p className="muted">
          Catatan yang Anda simpan akan membentuk grafik perjalanan Anda.
        </p>
      </div>
    );
  const minTime = new Date(points[0].measuredAt).valueOf(),
    maxTime = new Date(points.at(-1)!.measuredAt).valueOf();
  const axis = valueAxis(points.map((p) => p.valueMgDl));
  const xAt = (time: number) =>
    maxTime === minTime
      ? 420
      : 55 + ((time - minTime) / (maxTime - minTime)) * 730;
  const x = (p: Point) => xAt(new Date(p.measuredAt).valueOf());
  const yAt = (v: number) =>
    250 - ((v - axis.min) / (axis.max - axis.min)) * 210;
  const y = (p: Point) => yAt(p.valueMgDl);
  const tickLabel = new Intl.DateTimeFormat(
    "id-ID",
    maxTime - minTime < 2 * 864e5
      ? { hour: "2-digit", minute: "2-digit", timeZone: ZONES[zone] }
      : { day: "numeric", month: "short", timeZone: ZONES[zone] },
  );
  const describe = (p: Point) =>
    numberText(p.originalValue) +
    " " +
    p.originalUnit +
    " · " +
    dateTime(p.measuredAt, zone) +
    " · " +
    (CONTEXT_LABELS[p.measurementContext as keyof typeof CONTEXT_LABELS] ??
      p.measurementContext);
  return (
    <>
      <div
        className="chart-scroll"
        tabIndex={0}
        aria-label="Area grafik yang dapat digeser"
      >
        <svg
          className="chart"
          viewBox="0 0 840 295"
          role="group"
          aria-label="Grafik tren gula darah dalam mg/dL"
        >
          <text x="5" y="17" fill="#53686c" fontSize="11">
            mg/dL
          </text>
          {axis.ticks.map((v) => (
            <g key={v}>
              <line
                x1="55"
                x2="800"
                y1={yAt(v)}
                y2={yAt(v)}
                stroke="#d3e2dd"
                strokeDasharray="4 4"
              />
              <text
                x="44"
                y={yAt(v) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#53686c"
              >
                {v}
              </text>
            </g>
          ))}
          <polyline
            points={points.map((p) => x(p) + "," + y(p)).join(" ")}
            fill="none"
            stroke="#4d612d"
            strokeWidth="2.5"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p)}
              cy={y(p)}
              r="5"
              fill="#4d612d"
              stroke="white"
              strokeWidth="2"
              tabIndex={0}
              role="button"
              aria-label={describe(p)}
              onFocus={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(i);
                }
              }}
            >
              <title>{describe(p)}</title>
            </circle>
          ))}
          {timeTicks(minTime, maxTime, 5).map((t, i, all) => (
            <text
              key={t}
              x={xAt(t)}
              y="281"
              textAnchor={
                all.length === 1
                  ? "middle"
                  : i === 0
                    ? "start"
                    : i === all.length - 1
                      ? "end"
                      : "middle"
              }
              fontSize="11"
              fill="#53686c"
            >
              {tickLabel.format(t)}
            </text>
          ))}
          <text x="800" y="17" textAnchor="end" fontSize="11" fill="#53686c">
            {zone}
          </text>
        </svg>
      </div>
      <p className="muted small">
        Geser grafik jika tidak terlihat seluruhnya, atau buka tabel data di
        bawah.
      </p>
      <p className="chart-detail" aria-live="polite">
        {selected !== null && points[selected]
          ? describe(points[selected])
          : "Sentuh atau fokuskan titik untuk melihat detail pengukuran."}
      </p>
      <details className="chart-table">
        <summary>Lihat data grafik dalam tabel</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Nilai asli</th>
                <th>mg/dL</th>
                <th>Kondisi</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i}>
                  <td>{dateTime(p.measuredAt, zone)}</td>
                  <td>
                    {numberText(p.originalValue)} {p.originalUnit}
                  </td>
                  <td>{numberText(p.valueMgDl)}</td>
                  <td>
                    {
                      CONTEXT_LABELS[
                        p.measurementContext as keyof typeof CONTEXT_LABELS
                      ]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
