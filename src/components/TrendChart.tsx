"use client";
import { useState } from "react";
import {
  CONTEXT_LABELS,
  dateTime,
  numberText,
  type Point,
  type Timezone,
} from "@/lib/ui";
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
        <h3>Belum ada catatan pada periode ini</h3>
        <p className="muted">
          Catatan yang Anda simpan akan membentuk grafik perjalanan Anda.
        </p>
      </div>
    );
  const minTime = new Date(points[0].measuredAt).valueOf(),
    maxTime = new Date(points.at(-1)!.measuredAt).valueOf();
  const max = Math.max(...points.map((p) => p.valueMgDl)) * 1.15 || 1;
  const x = (p: Point) =>
    maxTime === minTime
      ? 420
      : 55 +
        ((new Date(p.measuredAt).valueOf() - minTime) / (maxTime - minTime)) *
          730;
  const y = (p: Point) => 250 - (p.valueMgDl / max) * 210;
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
          <text x="5" y="17" fill="#52676a" fontSize="11">
            mg/dL
          </text>
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <g key={r}>
              <line
                x1="55"
                x2="800"
                y1={250 - r * 210}
                y2={250 - r * 210}
                stroke="#dee7e5"
                strokeDasharray="4 4"
              />
              <text
                x="44"
                y={254 - r * 210}
                textAnchor="end"
                fontSize="11"
                fill="#52676a"
              >
                {Math.round(max * r)}
              </text>
            </g>
          ))}
          <polyline
            points={points.map((p) => x(p) + "," + y(p)).join(" ")}
            fill="none"
            stroke="#26736b"
            strokeWidth="2.5"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p)}
              cy={y(p)}
              r="5"
              fill="#16605b"
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
          <text x="55" y="281" fontSize="11" fill="#52676a">
            {dateTime(points[0].measuredAt, zone)}
          </text>
          <text x="800" y="281" textAnchor="end" fontSize="11" fill="#52676a">
            {dateTime(points.at(-1)!.measuredAt, zone)}
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
