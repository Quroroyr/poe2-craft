const intFormats = new Map<string, Intl.NumberFormat>();
const intFormat = (intlLocale: string) => {
  let format = intFormats.get(intlLocale);
  if (!format) intFormats.set(intlLocale, (format = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 })));
  return format;
};

export function formatPercent(p: number): string {
  const v = p * 100;
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0 %';
  if (v >= 99.995 && v < 100) return '>99.99 %';
  const digits = v >= 1 ? 2 : v >= 0.01 ? 3 : 4;
  return `${v.toFixed(digits)} %`;
}

/** Whole numbers grouped the way the interface language writes them (`intlLocale` from `INTL_LOCALE`). */
export function formatInt(n: number, intlLocale = 'en-US'): string {
  return Number.isFinite(n) ? intFormat(intlLocale).format(n) : '∞';
}

export function formatAttempts(n: number, intlLocale = 'en-US'): string {
  if (!Number.isFinite(n)) return '∞';
  return Number.isInteger(n) ? formatInt(n, intlLocale) : n.toFixed(1);
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
