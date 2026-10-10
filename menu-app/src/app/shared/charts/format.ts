/** ₹ with Indian grouping: 1,64,847 */
export function inr(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

/** Compact ₹ for axes and tiles: ₹950, ₹12.4K, ₹1.6L, ₹2.3Cr */
export function inrCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${trim(a / 1e7)}Cr`;
  if (a >= 1e5) return `${s}₹${trim(a / 1e5)}L`;
  if (a >= 1e3) return `${s}₹${trim(a / 1e3)}K`;
  return `${s}₹${Math.round(a)}`;
}

export function num(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function trim(x: number): string {
  return (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, '');
}

/** Clean axis ticks: 0 / 5K / 10K / 15K … */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rough) ?? 10 * pow;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function hourLabel(h: number): string {
  if (h === 0 || h === 24) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
