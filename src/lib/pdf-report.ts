import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { APP_CONFIG } from "./config";
import { timeTicks, valueAxis } from "./chart";
import { CONTEXT_LABELS, ZONES, dateTime, mgDlText, numberText, type Entry, type Profile } from "./ui";
import { glucoseSummary } from "./domain/glucose";

// GLB-048 / FR-REPORT-001: laporan A4 untuk dibawa ke dokter. Urutan baca: siapa & periode,
// ringkasan angka, tren, lalu catatan per hari. Warna dari brief (oxford/teal/mustard), tetapi
// semua penanda juga dibedakan bentuk sehingga tetap terbaca saat dicetak hitam-putih.

export type ReportEntry = Pick<
  Entry,
  "id" | "original_value" | "original_unit" | "normalized_mg_dl" | "measurement_context" | "measured_at" | "note"
>;
type Context = ReportEntry["measurement_context"];

const A4: [number, number] = [595.28, 841.89];
const LEFT = 44, RIGHT = 551, WIDTH = RIGHT - LEFT, BOTTOM = 72;
const C = {
  oxford: rgb(0x01 / 255, 0x1b / 255, 0x2f / 255),
  teal: rgb(0x30 / 255, 0x67 / 255, 0x71 / 255),
  mustard: rgb(1, 0xb9 / 255, 0x15 / 255),
  tile: rgb(0xdc / 255, 0xec / 255, 0xe6 / 255),
  wash: rgb(0.95, 0.97, 0.96),
  muted: rgb(0.33, 0.41, 0.42),
  line: rgb(0.82, 0.87, 0.85),
  white: rgb(1, 1, 1),
};

// Bentuk penanda per kondisi: sama di grafik dan tabel.
const CONTEXT_ORDER: Context[] = ["fasting", "before_meal", "after_meal", "random", "other"];
type Marker = "dot" | "ring" | "square" | "triangle" | "diamond";
const MARKERS: Record<Context, Marker> = {
  fasting: "dot",
  before_meal: "ring",
  after_meal: "square",
  random: "triangle",
  other: "diamond",
};

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/[\r\n\t]/g, " ").split(/\s+/)) {
    if (!word) continue;
    if (font.widthOfTextAtSize(line ? line + " " + word : word, size) <= width) {
      line = line ? line + " " + word : word;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const char of word) {
      if (font.widthOfTextAtSize(line + char, size) > width && line) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function marker(page: PDFPage, kind: Marker, x: number, y: number, r: number, color: RGB) {
  if (kind === "dot") page.drawCircle({ x, y, size: r, color });
  else if (kind === "ring") page.drawCircle({ x, y, size: r, borderColor: color, borderWidth: 1.1, color: C.white });
  else if (kind === "square") page.drawRectangle({ x: x - r, y: y - r, width: r * 2, height: r * 2, color });
  else {
    // drawSvgPath memakai sumbu y SVG (ke bawah) dari titik (x, y).
    const path =
      kind === "triangle"
        ? `M 0 ${-r * 1.15} L ${r * 1.1} ${r * 0.85} L ${-r * 1.1} ${r * 0.85} Z`
        : `M 0 ${-r * 1.25} L ${r * 1.1} 0 L 0 ${r * 1.25} L ${-r * 1.1} 0 Z`;
    page.drawSvgPath(path, { x, y, color });
  }
}

const zoneDate = (iso: string, zone: Profile["timezone_code"], opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", { ...opts, timeZone: ZONES[zone!] }).format(new Date(iso));

export async function createReport(
  profile: Profile,
  rawEntries: ReportEntry[],
  range: { from: string; toExclusive: string },
  now = new Date(),
) {
  const zone = profile.timezone_code!;
  const entries = [...rawEntries].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = join(process.cwd(), "assets/fonts");
  const font = await pdf.embedFont(await readFile(join(fonts, "LiberationSans-Regular.ttf")), { subset: true });
  const bold = await pdf.embedFont(await readFile(join(fonts, "LiberationSans-Bold.ttf")), { subset: true });
  const supported = new Set(font.getCharacterSet());
  const textContent = [profile.name ?? "", ...entries.map((e) => e.note ?? "")].join("");
  if ([...textContent].some((c) => c.charCodeAt(0) > 31 && !supported.has(c.codePointAt(0)!)))
    throw new Error("UNSUPPORTED_REPORT_CHARACTER");

  pdf.setTitle("Laporan Pemantauan Gula Darah");
  pdf.setAuthor("Glubee");
  pdf.setCreationDate(now);

  const periodEnd = new Date(new Date(range.toExclusive).valueOf() - 1).toISOString();
  const day = (iso: string) => zoneDate(iso, zone, { day: "numeric", month: "long", year: "numeric" });
  const periodText = `${day(range.from)} – ${day(periodEnd)}`;

  let page = pdf.addPage(A4);
  let y = 0;
  const text = (value: string, x: number, size = 10, color = C.oxford, f = font) =>
    page.drawText(value, { x, y, size, font: f, color });
  const textRight = (value: string, right: number, size = 10, color = C.oxford, f = font) =>
    text(value, right - f.widthOfTextAtSize(value, size), size, color, f);

  function continuationHeader() {
    page = pdf.addPage(A4);
    y = 800;
    text("glubee", LEFT, 12, C.teal, bold);
    textRight(`${profile.name ?? "-"} · ${periodText}`, RIGHT, 9, C.muted);
    y -= 10;
    page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, color: C.line, thickness: 0.6 });
    y -= 24;
  }

  // ---- Kepala halaman pertama: identitas Glubee dan pengguna.
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: C.mustard });
  const mascot = await pdf.embedPng(await readFile(join(process.cwd(), "assets/brand/mascot-line.png")));
  const m = mascot.scaleToFit(44, 52);
  page.drawImage(mascot, { x: RIGHT - m.width, y: 812 - m.height, ...m });
  y = 790;
  text("glubee", LEFT, 16, C.teal, bold);
  y -= 30;
  text("Laporan Pemantauan Gula Darah", LEFT, 22, C.oxford, bold);
  y -= 26;
  const identity: [string, string][] = [
    ["Nama", profile.name ?? "-"],
    ["Tanggal lahir", profile.birth_date ? zoneDate(`${profile.birth_date}T12:00:00Z`, "WIB", { day: "numeric", month: "long", year: "numeric" }) : "-"],
    ["Periode", periodText],
    ["Zona waktu", zone],
  ];
  const colX = [LEFT, LEFT + 160, LEFT + 270, LEFT + 455];
  identity.forEach(([label, value], i) => {
    page.drawText(label.toUpperCase(), { x: colX[i], y, size: 7.5, font: bold, color: C.muted });
    const lines = wrap(value, font, 10, (colX[i + 1] ?? RIGHT) - colX[i] - 10);
    lines.slice(0, 2).forEach((l, j) => page.drawText(l, { x: colX[i], y: y - 14 - j * 12, size: 10, font, color: C.oxford }));
  });
  y -= 44;
  text(`Dibuat ${dateTime(now.toISOString(), zone)} · ${entries.length} catatan valid`, LEFT, 8.5, C.muted);
  y -= 22;

  // ---- Ringkasan angka.
  const summary = glucoseSummary(entries);
  const cards: [string, string, string][] = [
    ["Rata-rata", mgDlText(summary.averageMgDl), "mg/dL"],
    ["Terendah", mgDlText(summary.minimumMgDl), "mg/dL"],
    ["Tertinggi", mgDlText(summary.maximumMgDl), "mg/dL"],
    ["Jumlah", String(summary.count), "catatan"],
  ];
  const gap = 10, cardW = (WIDTH - gap * 3) / 4, cardH = 62;
  cards.forEach(([label, value, unit], i) => {
    const x = LEFT + i * (cardW + gap);
    const lead = i === 0;
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: lead ? C.tile : C.wash, borderColor: lead ? C.teal : C.line, borderWidth: lead ? 1 : 0.6 });
    page.drawText(label, { x: x + 12, y: y - 18, size: 9, font: bold, color: C.muted });
    page.drawText(value, { x: x + 12, y: y - 46, size: 22, font: bold, color: C.oxford });
    page.drawText(unit, { x: x + 16 + bold.widthOfTextAtSize(value, 22), y: y - 46, size: 9, font, color: C.muted });
  });
  y -= cardH + 14;
  text("Nilai ditampilkan apa adanya tanpa evaluasi atau label medis. Catatan yang ditandai salah tidak disertakan.", LEFT, 8.5, C.muted);
  y -= 26;

  // ---- Ringkasan per kondisi pengukuran.
  const byContext = CONTEXT_ORDER.map((ctx) => {
    const list = entries.filter((e) => e.measurement_context === ctx);
    return { ctx, s: glucoseSummary(list) };
  }).filter((r) => r.s.count > 0);
  if (byContext.length) {
    text("Per kondisi pengukuran", LEFT, 12, C.oxford, bold);
    y -= 18;
    const cols = [LEFT + 8, LEFT + 230, LEFT + 320, LEFT + 420];
    page.drawRectangle({ x: LEFT, y: y - 6, width: WIDTH, height: 18, color: C.wash });
    ["Kondisi", "Jumlah", "Rata-rata", "Rentang (mg/dL)"].forEach((h, i) => page.drawText(h, { x: cols[i], y, size: 8.5, font: bold, color: C.muted }));
    y -= 20;
    for (const { ctx, s } of byContext) {
      marker(page, MARKERS[ctx], cols[0] + 4, y + 3, 3.2, C.teal);
      text(CONTEXT_LABELS[ctx], cols[0] + 14, 9.5);
      text(String(s.count), cols[1], 9.5);
      text(`${mgDlText(s.averageMgDl)} mg/dL`, cols[2], 9.5);
      text(`${mgDlText(s.minimumMgDl)} – ${mgDlText(s.maximumMgDl)}`, cols[3], 9.5);
      y -= 6;
      page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, color: C.line, thickness: 0.4 });
      y -= 13;
    }
    y -= 14;
  }

  // ---- Grafik tren: sumbu nilai mengikuti data, label tanggal seperti grafik web.
  if (entries.length) {
    if (y < 250) continuationHeader();
    text("Tren gula darah (mg/dL)", LEFT, 12, C.oxford, bold);
    y -= 16;
    const values = entries.map((e) => Number(e.normalized_mg_dl));
    const axis = valueAxis(values);
    const plot = { left: LEFT + 34, right: RIGHT - 6, top: y - 4, bottom: y - 154 };
    const t0 = new Date(entries[0].measured_at).valueOf(), t1 = new Date(entries.at(-1)!.measured_at).valueOf();
    const x0 = plot.left + 10, x1 = plot.right - 6;
    const px = (t: number) => (t1 === t0 ? (x0 + x1) / 2 : x0 + ((t - t0) / (t1 - t0)) * (x1 - x0));
    const py = (v: number) => plot.bottom + ((v - axis.min) / (axis.max - axis.min)) * (plot.top - plot.bottom);
    for (const tick of axis.ticks) {
      page.drawLine({ start: { x: plot.left, y: py(tick) }, end: { x: plot.right, y: py(tick) }, color: C.line, thickness: 0.5 });
      const label = mgDlText(tick);
      page.drawText(label, { x: plot.left - 6 - font.widthOfTextAtSize(label, 8), y: py(tick) - 3, size: 8, font, color: C.muted });
    }
    const points = entries.map((e) => ({ x: px(new Date(e.measured_at).valueOf()), y: py(Number(e.normalized_mg_dl)), ctx: e.measurement_context }));
    for (let i = 1; i < points.length; i++)
      page.drawLine({ start: points[i - 1], end: points[i], color: C.teal, thickness: 0.9, opacity: 0.55 });
    const r = points.length > 120 ? 1.8 : 2.8;
    for (const p of points) marker(page, MARKERS[p.ctx], p.x, p.y, r, C.oxford);
    // Label tanggal: maksimal 5, tanpa duplikat hari yang sama.
    const ticks = t1 === t0 ? [t0] : timeTicks(t0, t1, 5);
    const seen = new Set<string>();
    for (const t of ticks) {
      const label = zoneDate(new Date(t).toISOString(), zone, { day: "numeric", month: "short" });
      if (seen.has(label)) continue;
      seen.add(label);
      const w = font.widthOfTextAtSize(label, 8);
      const x = Math.min(Math.max(px(t) - w / 2, plot.left - 4), plot.right - w);
      page.drawText(label, { x, y: plot.bottom - 14, size: 8, font, color: C.muted });
    }
    y = plot.bottom - 32;
    // Legenda bentuk penanda.
    let lx = LEFT;
    for (const ctx of CONTEXT_ORDER.filter((c) => entries.some((e) => e.measurement_context === c))) {
      marker(page, MARKERS[ctx], lx + 4, y + 3, 3, C.oxford);
      page.drawText(CONTEXT_LABELS[ctx], { x: lx + 12, y, size: 8.5, font, color: C.oxford });
      lx += 24 + font.widthOfTextAtSize(CONTEXT_LABELS[ctx], 8.5);
    }
    y -= 30;
  } else {
    text("Belum ada pengukuran valid pada periode ini.", LEFT, 12, C.oxford, bold);
    y -= 30;
  }

  // ---- Tabel catatan, dikelompokkan per hari (zona pengguna).
  const cols = { time: LEFT + 8, value: LEFT + 62, context: LEFT + 170, note: LEFT + 305 };
  const noteWidth = RIGHT - cols.note - 6;
  function tableHeader() {
    page.drawRectangle({ x: LEFT, y: y - 6, width: WIDTH, height: 18, color: C.oxford });
    const h = (s: string, x: number) => page.drawText(s, { x, y, size: 8.5, font: bold, color: C.white });
    h("Jam", cols.time);
    h("Nilai asli", cols.value);
    h("Kondisi", cols.context);
    h("Catatan", cols.note);
    y -= 22;
  }
  if (entries.length) {
    if (y < 160) continuationHeader();
    text("Catatan pengukuran", LEFT, 12, C.oxford, bold);
    y -= 18;
    tableHeader();
    let currentDay = "";
    for (const e of entries) {
      const dayLabel = zoneDate(e.measured_at, zone, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const notes = e.note ? wrap(e.note, font, 9, noteWidth) : [];
      const rowH = Math.max(1, notes.length) * 12 + 8;
      const needsDay = dayLabel !== currentDay;
      const needed = rowH + (needsDay ? 22 : 0);
      if (y - needed < BOTTOM && needed < 600) {
        continuationHeader();
        tableHeader();
        currentDay = "";
      }
      if (dayLabel !== currentDay) {
        currentDay = dayLabel;
        page.drawRectangle({ x: LEFT, y: y - 5, width: WIDTH, height: 17, color: C.tile });
        text(dayLabel, cols.time, 9, C.oxford, bold);
        y -= 20;
      }
      text(zoneDate(e.measured_at, zone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", "."), cols.time, 9.5);
      const value = numberText(Number(e.original_value));
      text(value, cols.value, 10.5, C.oxford, bold);
      text(e.original_unit, cols.value + 4 + bold.widthOfTextAtSize(value, 10.5), 8.5, C.muted);
      marker(page, MARKERS[e.measurement_context], cols.context + 3, y + 3.5, 3, C.teal);
      text(CONTEXT_LABELS[e.measurement_context], cols.context + 12, 9.5);
      notes.forEach((line, i) => {
        // Catatan sangat panjang boleh berlanjut ke halaman berikutnya.
        if (i && y < BOTTOM) {
          continuationHeader();
          tableHeader();
        }
        text(line, cols.note, 9, C.muted);
        if (i < notes.length - 1) y -= 12;
      });
      y -= 8;
      page.drawLine({ start: { x: LEFT, y }, end: { x: RIGHT, y }, color: C.line, thickness: 0.4 });
      y -= 14;
    }
  }

  // ---- Catatan penting: lengkap di akhir laporan, ringkas di kaki setiap halaman.
  const notice = [APP_CONFIG.disclaimer, APP_CONFIG.developerNotice];
  const noticeLines = notice.flatMap((p) => wrap(p, font, 8, WIDTH - 24));
  const noticeH = noticeLines.length * 11 + 36;
  y -= 4;
  if (y - noticeH < BOTTOM) continuationHeader();
  page.drawRectangle({ x: LEFT, y: y - noticeH, width: WIDTH, height: noticeH, borderColor: C.line, borderWidth: 0.6, color: C.white });
  y -= 18;
  text("Catatan penting", LEFT + 12, 9, C.oxford, bold);
  y -= 16;
  for (const line of noticeLines) {
    text(line, LEFT + 12, 8, C.muted);
    y -= 11;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: LEFT, y: 50 }, end: { x: RIGHT, y: 50 }, color: C.line, thickness: 0.5 });
    p.drawText("Catatan mandiri, bukan diagnosis atau rekam medis resmi. Glubee · glubee.id", { x: LEFT, y: 36, size: 8, font, color: C.muted });
    const n = `Halaman ${i + 1} / ${pages.length}`;
    p.drawText(n, { x: RIGHT - font.widthOfTextAtSize(n, 8), y: 36, size: 8, font, color: C.muted });
  });
  return pdf.save();
}
