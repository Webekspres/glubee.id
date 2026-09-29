const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

// Sumbu nilai mengikuti rentang data (bukan dari 0) agar variasi harian terlihat.
export function valueAxis(values: number[]) {
  const low = Math.min(...values),
    high = Math.max(...values);
  const span = Math.max(high - low, 20);
  const step = STEPS.find((s) => span / s <= 4) ?? 1000;
  const min = Math.max(0, Math.floor((low - step / 2) / step) * step);
  const max = Math.ceil((high + step / 2) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return { min, max, ticks };
}

export function timeTicks(start: number, end: number, count: number) {
  if (end <= start) return [start];
  return Array.from(
    { length: count },
    (_, i) => start + ((end - start) * i) / (count - 1),
  );
}
