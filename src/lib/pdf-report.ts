import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { APP_CONFIG } from "./config";
import {
  CONTEXT_LABELS,
  dateTime,
  numberText,
  type Profile,
  type Entry,
} from "./ui";
import { glucoseSummary } from "./domain/glucose";
export type ReportEntry = Pick<
  Entry,
  | "id"
  | "original_value"
  | "original_unit"
  | "normalized_mg_dl"
  | "measurement_context"
  | "measured_at"
  | "note"
>;
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/[\r\n\t]/g, " ").split(/\s+/)) {
    if (!word) continue;
    if (
      font.widthOfTextAtSize(line ? line + " " + word : word, size) <= width
    ) {
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
export async function createReport(
  profile: Profile,
  entries: ReportEntry[],
  range: { from: string; toExclusive: string },
  now = new Date(),
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(
      join(process.cwd(), "assets/fonts/LiberationSans-Regular.ttf"),
    ),
    { subset: true },
  );
  const supported = new Set(font.getCharacterSet());
  const textContent = [
    profile.name ?? "",
    ...entries.map((e) => e.note ?? ""),
  ].join("");
  if (
    [...textContent].some(
      (c) => c.charCodeAt(0) > 31 && !supported.has(c.codePointAt(0)!),
    )
  )
    throw new Error("UNSUPPORTED_REPORT_CHARACTER");
  const ink = rgb(0.09, 0.18, 0.2),
    muted = rgb(0.32, 0.4, 0.42),
    green = rgb(0.08, 0.36, 0.33),
    lineColor = rgb(0.82, 0.87, 0.85);
  let page = pdf.addPage([595.28, 841.89]),
    y = 792;
  function text(value: string, x = 44, size = 10, color = ink) {
    page.drawText(value, { x, y, size, font, color });
  }
  function nextPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 794;
    text("Glubee / Laporan Pemantauan Gula Darah", 44, 11, green);
    y -= 28;
  }
  function paragraph(value: string, size = 10, width = 505) {
    for (const line of wrap(value, font, size, width)) {
      if (y < 75) nextPage();
      text(line, 44, size);
      y -= size * 1.5;
    }
    y -= 8;
  }
  pdf.setTitle("Laporan Pemantauan Gula Darah");
  pdf.setAuthor("Glubee");
  pdf.setCreationDate(now);
  text("GLUBEE", 44, 12, green);
  y -= 35;
  text("Laporan Pemantauan Gula Darah", 44, 21);
  y -= 30;
  paragraph(
    "Nama: " +
      (profile.name ?? "-") +
      " | Tanggal lahir: " +
      (profile.birth_date ?? "-") +
      " | Zona: " +
      profile.timezone_code,
  );
  paragraph(
    "Periode: " +
      dateTime(range.from, profile.timezone_code!) +
      " sampai " +
      dateTime(
        new Date(new Date(range.toExclusive).valueOf() - 1).toISOString(),
        profile.timezone_code!,
      ),
  );
  paragraph("Dibuat: " + dateTime(now.toISOString(), profile.timezone_code!));
  paragraph(APP_CONFIG.disclaimer, 10);
  paragraph(APP_CONFIG.developerNotice, 9);
  const summary = glucoseSummary(entries);
  paragraph(
    "Catatan valid: " +
      summary.count +
      "  |  Rata-rata: " +
      numberText(summary.averageMgDl) +
      " mg/dL  |  Min: " +
      numberText(summary.minimumMgDl) +
      "  |  Maks: " +
      numberText(summary.maximumMgDl),
    10,
  );
  paragraph(
    "Status belum dievaluasi. Catatan yang ditandai salah tidak disertakan.",
    9,
  );
  if (entries.length) {
    if (y < 290) nextPage();
    text("Tren pengukuran (mg/dL)", 44, 12, green);
    y -= 18;
    const top = y,
      bottom = y - 135,
      max = Math.max(...entries.map((e) => Number(e.normalized_mg_dl))) * 1.15;
    const t0 = new Date(entries[0].measured_at).valueOf(),
      t1 = new Date(entries.at(-1)!.measured_at).valueOf();
    const point = (e: ReportEntry) => ({
      x:
        t0 === t1
          ? 300
          : 80 + ((new Date(e.measured_at).valueOf() - t0) / (t1 - t0)) * 460,
      y: bottom + (Number(e.normalized_mg_dl) / max) * 130,
    });
    for (const r of [0, 0.5, 1]) {
      page.drawLine({
        start: { x: 80, y: bottom + r * 130 },
        end: { x: 550, y: bottom + r * 130 },
        color: lineColor,
        thickness: 0.5,
      });
      page.drawText(String(Math.round(max * r)), {
        x: 44,
        y: bottom + r * 130 - 3,
        font,
        size: 8,
        color: muted,
      });
    }
    for (let i = 0; i < entries.length; i++) {
      const p = point(entries[i]);
      if (i)
        page.drawLine({
          start: point(entries[i - 1]),
          end: p,
          color: green,
          thickness: 1,
        });
      page.drawCircle({ ...p, size: 2, color: green });
    }
    y = bottom - 18;
    text(
      dateTime(entries[0].measured_at, profile.timezone_code!),
      80,
      8,
      muted,
    );
    const last = dateTime(entries.at(-1)!.measured_at, profile.timezone_code!);
    text(last, 550 - font.widthOfTextAtSize(last, 8), 8, muted);
    y = top - 180;
  } else paragraph("Belum ada pengukuran valid pada periode ini.", 12);
  function header() {
    if (y < 125) nextPage();
    page.drawRectangle({
      x: 44,
      y: y - 10,
      width: 507,
      height: 26,
      color: rgb(0.94, 0.96, 0.95),
    });
    text("Waktu pengukuran", 50, 9);
    text("Nilai asli", 235, 9);
    text("Kondisi / catatan", 340, 9);
    y -= 32;
  }
  if (entries.length) {
    header();
    for (const e of entries) {
      const details = [
        CONTEXT_LABELS[e.measurement_context],
        ...(e.note ? wrap(e.note, font, 9, 202) : []),
      ];
      const left = wrap(
        dateTime(e.measured_at, profile.timezone_code!),
        font,
        9,
        175,
      );
      const value = wrap(
        numberText(Number(e.original_value)) + " " + e.original_unit,
        font,
        9,
        96,
      );
      const rows = Math.max(details.length, left.length, value.length);
      // Keep ordinary records together; exceptionally long notes can continue.
      if (rows * 14 + 18 <= 650 && y - rows * 14 - 18 < 80) {
        nextPage();
        header();
      }
      for (let i = 0; i < rows; i++) {
        if (y < 80) {
          nextPage();
          header();
        }
        if (left[i]) text(left[i], 50, 9);
        if (value[i]) text(value[i], 235, 9);
        if (details[i]) text(details[i], 340, 9);
        y -= 14;
      }
      y -= 2;
      page.drawLine({
        start: { x: 44, y },
        end: { x: 551, y },
        color: lineColor,
        thickness: 0.5,
      });
      y -= 16;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText("Catatan mandiri - bukan diagnosis atau rekam medis resmi.", {
      x: 44,
      y: 38,
      size: 8,
      font,
      color: muted,
    });
    p.drawText(i + 1 + " / " + pages.length, {
      x: 510,
      y: 38,
      size: 8,
      font,
      color: muted,
    });
  });
  return pdf.save();
}
