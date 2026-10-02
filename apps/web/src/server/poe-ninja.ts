/** Node-only infrastructure. Public economy endpoints, conditional requests, shared disk cache. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { PriceSnapshot } from '@poe2-craft/economy';

export const PRICE_TYPES = ['Currency','Ritual','Essences','Runes','SoulCores','Abyss','Delirium','Breach'] as const;
const USER_AGENT = 'PoE2CraftPlanner/0.7 (https://github.com/Quroroyr/poe2-craft)';
const TTL = 300_000;
interface Cached { data: unknown; etag?: string; capturedAt: string; checkedAt: number; ttl: number }
const pending = new Map<string, Promise<Cached>>();

async function cachedJSON(path: string, cacheDir: string): Promise<Cached> {
  const key = `${cacheDir}:${path}`;
  const active = pending.get(key); if (active) return active;
  const task = (async () => {
    await mkdir(cacheDir, { recursive:true });
    const file = join(cacheDir, `${createHash('sha256').update(path).digest('hex')}.json`);
    let old: Cached | undefined;
    try { old = JSON.parse(await readFile(file,'utf8')) as Cached; } catch { /* First fetch. */ }
    if (old && Date.now() - old.checkedAt < old.ttl) return old;
    const response = await fetch(`https://poe.ninja/poe2/api/economy/${path}`, { headers:{ 'User-Agent':USER_AGENT, ...(old?.etag ? {'If-None-Match':old.etag} : {}) }, signal:AbortSignal.timeout(20_000) });
    let result: Cached;
    if (response.status === 304 && old) result = { ...old, checkedAt:Date.now() };
    else {
      if (!response.ok) throw new Error(`poe.ninja HTTP ${response.status}`);
      const data: unknown = await response.json();
      const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 300) * 1000;
      result = { data, etag:response.headers.get('etag') ?? undefined, capturedAt:new Date().toISOString(), checkedAt:Date.now(), ttl:Math.max(TTL,maxAge) };
    }
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary,JSON.stringify(result)); await rename(temporary,file);
    return result;
  })();
  pending.set(key,task);
  try { return await task; } finally { pending.delete(key); }
}

export interface EconomyLeague { id: string; name: string }
export async function economyLeagues(cacheDir: string): Promise<EconomyLeague[]> {
  const result = await cachedJSON('leagues',cacheDir);
  if (!Array.isArray(result.data) || !result.data.every((l) => l && typeof l.id === 'string' && typeof l.name === 'string')) throw new Error('Invalid poe.ninja leagues response');
  return result.data;
}

export function normalizeOverview(data: unknown): { unit:string; prices:Record<string,number> } {
  const body = data as { core?: { primary?: string }; lines?: { id?: string; primaryValue?: number }[] };
  if (!body || !body.core?.primary || !Array.isArray(body.lines)) throw new Error('Invalid exchange overview');
  const unit = body.core.primary === 'divine' ? 'div' : body.core.primary;
  const prices: Record<string,number> = { [body.core.primary]:1 };
  for (const line of body.lines) if (typeof line.id === 'string' && typeof line.primaryValue === 'number' && Number.isFinite(line.primaryValue) && line.primaryValue >= 0) prices[line.id] = line.primaryValue;
  return {unit,prices};
}

export async function economySnapshot(league: string, cacheDir: string): Promise<PriceSnapshot> {
  const leagues = await economyLeagues(cacheDir);
  if (!leagues.some((l) => l.id === league)) throw new Error('Unknown economy league');
  const prices: Record<string,number> = {};
  let unit: string | null = null;
  const captured: string[] = [];
  for (const type of PRICE_TYPES) {
    const response = await cachedJSON(`exchange/current/overview?${new URLSearchParams({league,type})}`,cacheDir);
    const normalized = normalizeOverview(response.data);
    if (unit && unit !== normalized.unit) throw new Error('Mixed price units from poe.ninja');
    unit = normalized.unit; Object.assign(prices,normalized.prices); captured.push(response.capturedAt);
  }
  return {id:`poe.ninja:${league}:${captured.sort()[0]}`,league,unit:unit!,capturedAt:captured.sort()[0]!,source:'poe.ninja',prices};
}
