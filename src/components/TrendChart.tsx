"use client";
import { useEffect, useRef, useState } from "react";
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
  // Grafik digambar selebar wadahnya (bukan 840 px tetap) agar catatan terbaru
  // selalu terlihat di layar ponsel tanpa digeser.
  const [width, setWidth] = useState(840);
  const box = useRef<HTMLDivElement>(null);
  const empty = points.length === 0;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(300, Math.round(entry.contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [empty]);
  if (!points.length)
    return (
      <div className="empty">
        <Mascot width={88} />
        <h3>Belum ada catatan pada periode ini</h3>
        <p className="muted">
          Simpan hasil pengukuran berikutnya, atau pilih periode yang lebih
          panjang, untuk melihat grafiknya di sini.
        </p>
      </div>
    );
  const W = width,
    H = W < 520 ? 240 : 290,
    LEFT = 44,
    RIGHT = W - 18,
    TOP = 38,
    BOTTOM = H - 42;
  const minTime = new Date(points[0].measuredAt).valueOf(),
    maxTime = new Date(points.at(-1)!.measuredAt).valueOf();
  const axis = valueAxis(points.map((p) => p.valueMgDl));
  const xAt = (time: number) =>
    maxTime === minTime
      ? (LEFT + RIGHT) / 2
      : LEFT + ((time - minTime) / (maxTime - minTime)) * (RIGHT - LEFT);
  const x = (p: Point) => xAt(new Date(p.measuredAt).valueOf());
  const yAt = (v: number) =>
    BOTTOM - ((v - axis.min) / (axis.max - axis.min)) * (BOTTOM - TOP);
  const y = (p: Point) => yAt(p.valueMgDl);
  const tickLabel = new Intl.DateTimeFormat(
    "id-ID",
    maxTime - minTime < 2 * 864e5
      ? { hour: "2-digit", minute: "2-digit", timeZone: ZONES[zone] }
      : { day: "numeric", month: "short", timeZone: ZONES[zone] },
  );
  const last = points.length - 1;
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
      <div className="chart-box" ref={box}>
        <svg
          className="chart"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="group"
          aria-label="Grafik tren gula darah dalam mg/dL"
        >
          <text x="4" y="16" className="chart-axis">
            mg/dL
          </text>
          <text x={RIGHT} y="16" textAnchor="end" className="chart-axis">
            {zone}
          </text>
          {axis.ticks.map((v) => (
            <g key={v}>
              <line
                x1={LEFT}
                x2={RIGHT}
                y1={yAt(v)}
                y2={yAt(v)}
                stroke="#d3e2dd"
                strokeDasharray="4 4"
              />
              <text
                x={LEFT - 8}
                y={yAt(v) + 4}
                textAnchor="end"
                className="chart-axis"
              >
                {v}
              </text>
            </g>
          ))}
          <polyline
            points={points.map((p) => x(p) + "," + y(p)).join(" ")}
            fill="none"
            stroke="#4d612d"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(p)}
              cy={y(p)}
              r={i === last ? 7 : 5}
              fill={i === last ? "#ffb915" : "#4d612d"}
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
          {timeTicks(minTime, maxTime, W < 520 ? 3 : 5).map((t, i, all) => (
            <text
              key={t}
              x={xAt(t)}
              y={H - 14}
              textAnchor={
                all.length === 1
                  ? "middle"
                  : i === 0
                    ? "start"
                    : i === all.length - 1
                      ? "end"
                      : "middle"
              }
              className="chart-axis"
            >
              {tickLabel.format(t)}
            </text>
          ))}
        </svg>
      </div>
      <p className="chart-detail" aria-live="polite">
        {selected !== null && points[selected]
          ? describe(points[selected])
          : "Titik kuning adalah catatan terbaru: " + describe(points[last])}
      </p>
      <details className="chart-table">
        <summary>Lihat data grafik dalam tabel</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabel data grafik"
        >
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
