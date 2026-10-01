const intFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export function formatPercent(p: number): string {
  const v = p * 100;
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0 %';
  if (v >= 99.995 && v < 100) return '>99.99 %';
  const digits = v >= 1 ? 2 : v >= 0.01 ? 3 : 4;
  return `${v.toFixed(digits)} %`;
}

export function formatInt(n: number): string {
  return Number.isFinite(n) ? intFormat.format(n) : '∞';
}

export function formatAttempts(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return Number.isInteger(n) ? formatInt(n) : n.toFixed(1);
}

export function formatCost(value: number, unit: string): string {
  if (!Number.isFinite(value)) return `∞ ${unit}`;
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 3;
  return `${Number(value.toFixed(digits)).toString()} ${unit}`;
}

export function formatQuantile(q: number): string {
  return `${Math.round(q * 100)}%`;
}
