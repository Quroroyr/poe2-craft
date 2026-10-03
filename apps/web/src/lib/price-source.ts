import type { PriceSnapshot } from '@poe2-craft/economy';
import { STATIC_SITE, publicUrl } from './site';

export interface League {
  readonly id: string;
  readonly name: string;
}

/** Built at deploy time by `pnpm data:prices` (see .github/workflows/pages.yml); absent = no market prices. */
const SNAPSHOT_FILE = '/prices/latest.json';

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`price source ${response.status}`);
  return (await response.json()) as T;
}

/** Leagues with market prices: from the server proxy, or the one league of the static snapshot. */
export async function fetchLeagues(): Promise<League[]> {
  if (!STATIC_SITE) return json<League[]>('/api/prices');
  const snapshot = await json<PriceSnapshot>(publicUrl(SNAPSHOT_FILE));
  return snapshot.league ? [{ id: snapshot.league, name: snapshot.league }] : [];
}

export async function fetchPriceSnapshot(league: string): Promise<PriceSnapshot> {
  if (!STATIC_SITE) return json<PriceSnapshot>(`/api/prices?league=${encodeURIComponent(league)}`);
  return json<PriceSnapshot>(publicUrl(SNAPSHOT_FILE));
}
