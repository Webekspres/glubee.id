// Pratinjau dashboard di landing page. Semua angka adalah data contoh; tidak ada
// pita "normal/target" karena evaluasi nilai belum disetujui (GLB-P01).
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const VALUES = [112, 128, 104, 146, 118, 94, 124];
const MIN = 80,
  MAX = 160,
  TOP = 12,
  BOTTOM = 120;
const x = (i: number) => 36 + (i * 314) / (VALUES.length - 1);
const y = (v: number) => TOP + ((MAX - v) / (MAX - MIN)) * (BOTTOM - TOP);

export function HeroPreview() {
  const line = VALUES.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = VALUES.length - 1;
  const average = Math.round(
    VALUES.reduce((a, b) => a + b, 0) / VALUES.length,
  );
  return (
    <div
      className="panel hero-preview"
      role="img"
      aria-label="Contoh tampilan ringkasan Glubee dengan data contoh: rata-rata, nilai terendah dan tertinggi, grafik tujuh hari, catatan terbaru, dan laporan PDF."
    >
      <div className="hero-preview-head" aria-hidden="true">
        <p className="hero-card-title">Ringkasan 7 hari terakhir</p>
        <span className="badge">Data contoh</span>
      </div>

      <div className="hero-metrics" aria-hidden="true">
        {[
          ["Rata-rata", average, " is-average"],
          ["Terendah", Math.min(...VALUES), ""],
          ["Tertinggi", Math.max(...VALUES), ""],
        ].map(([label, value, modifier]) => (
          <div key={label} className={"hero-metric" + modifier}>
            <span>{label}</span>
            <strong>
              {value}
              <small> mg/dL</small>
            </strong>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 360 150" aria-hidden="true" className="hero-chart">
        <defs>
          <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4d612d" stopOpacity="0.28" />
            <stop offset="1" stopColor="#4d612d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[MAX, 120, MIN].map((v) => (
          <g key={v}>
            <line
              x1="36"
              x2="350"
              y1={y(v)}
              y2={y(v)}
              stroke="#d3e2dd"
              strokeDasharray="4 5"
            />
            <text x="28" y={y(v) + 3.5} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        <path
          d={`M${line.replaceAll(" ", " L")} L${x(last)},${BOTTOM} L${x(0)},${BOTTOM} Z`}
          fill="url(#hero-area)"
        />
        <polyline
          points={line}
          fill="none"
          stroke="#4d612d"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {VALUES.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={i === last ? 6.5 : 4.5}
            fill={i === last ? "#ffb915" : "#4d612d"}
            stroke="white"
            strokeWidth="2"
          />
        ))}
        <g transform={`translate(${x(last) - 128}, ${y(VALUES[last]) - 46})`}>
          <rect width="136" height="30" rx="8" fill="#011b2f" />
          <text x="68" y="19.5" textAnchor="middle" className="tip">
            Hari ini · {VALUES[last]} mg/dL
          </text>
        </g>
        {DAYS.map((d, i) => (
          <text
            key={d}
            x={x(i)}
            y="142"
            textAnchor="middle"
            className={"axis" + (i === last ? " is-today" : "")}
          >
            {d}
          </text>
        ))}
      </svg>

      <ul className="hero-entries" aria-hidden="true">
        {[
          ["☀️", "Puasa", "Hari ini, 06.45", 98],
          ["🍽️", "2 jam setelah makan", "Kemarin, 13.10", 142],
        ].map(([icon, context, time, value]) => (
          <li key={context}>
            <span className="hero-entry-icon">{icon}</span>
            <span className="hero-entry-text">
              <strong>{context}</strong>
              <small>{time}</small>
            </span>
            <strong className="hero-entry-value">
              {value}
              <small> mg/dL</small>
            </strong>
          </li>
        ))}
      </ul>

      <p className="hero-report" aria-hidden="true">
        <span>📄</span> Laporan PDF siap dibawa saat konsultasi
      </p>
    </div>
  );
}
