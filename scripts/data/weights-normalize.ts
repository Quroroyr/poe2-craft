/**
 * WEIGHTS NORMALIZE step:  data/raw/poe2db/*.json  →  packages/craft-db/src/production/poe2db-weights.json
 *
 * PoE2DB rows carry no modifier id. A row is matched to our modifier (RePoE id) among the explicit
 * modifiers that can spawn on a base of the page's class, by:
 *   1. side (ModGenerationTypeID 1 = prefix, 2 = suffix) + required level + affix name;
 *   2. if several remain: the rolled numbers of the row (`mod-value` spans) = our ranges;
 *   3. if several remain: the spawn tags of the row (`spawn_no`) contain every tag our modifier spawns on;
 *   4. if several remain: the PoE2DB family list = our collision groups / family.
 * Display text is never the key. Zero or several candidates → the row is reported as unresolved.
 *
 * A page is one weight table: the group of bases PoE2DB published it for (a class, or a class
 * with one attribute tag such as `str_armour`). Each base is assigned to the table of its class whose
 * tags it carries — the most specific one; several equally specific tables → not assigned, reported.
 * A base takes weights from its own table only: a value measured for maces is never reused on bows,
 * even where the game would share the spawn tag. A modifier listed twice in one table with different
 * values is a conflict: it is left out and reported.
 *
 * PoE2DB writes 1 (or 0) where no measurement exists — whole classes (daggers, flails, flasks,
 * charms…) and single families (cast speed on rings…). Such rows are "no data": the weight stays null.
 * Any value is kept as published (raw); nothing is rescaled.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WeightManifest } from './weights-fetch.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'data', 'raw', 'poe2db');
const DATA = join(ROOT, 'packages', 'craft-db', 'src', 'production', 'poe2-data.json');
const OUT = join(ROOT, 'packages', 'craft-db', 'src', 'production', 'poe2db-weights.json');
/** Values at or below this are PoE2DB's "no measurement" markers, not weights. */
const PLACEHOLDER_MAX = 1;

interface Spawn { tag: string; weight: number | null; spawns?: boolean }
interface Mod {
  id: string; name: string; side: string; layer?: string; domain?: string; family?: string;
  groupIds: string[]; requiredItemLevel: number;
  lines: { template: string; ranges: { min: number; max: number }[] }[];
  spawnWeights: Spawn[];
}
interface Base { id: string; name: string; itemClassId: string; domain?: string; tags: string[] }
interface Row {
  Name: string; Level: string | number; ModGenerationTypeID: string | number; ModFamilyList?: string[];
  DropChance: string | number; str: string; spawn_no?: string[];
}

export function decidingSpawn(mod: Pick<Mod, 'spawnWeights'>, tags: readonly string[]): Spawn | null {
  for (const entry of mod.spawnWeights) if (tags.includes(entry.tag)) return entry;
  return null;
}
const spawnable = (mod: Mod, base: Base) =>
  (mod.domain === undefined || base.domain === undefined || mod.domain === base.domain) && decidingSpawn(mod, base.tags)?.spawns === true;

/** Numbers of the rolled values in a PoE2DB cell: only inside `mod-value` spans (other digits are text). */
export function rowNumbers(html: string): number[] {
  const values: string[] = [];
  const open = "<span class='mod-value'>";
  for (let at = html.indexOf(open); at >= 0; at = html.indexOf(open, at + 1)) {
    // The value span nests other spans (the range dash): close it at depth 0.
    let depth = 1;
    let i = at + open.length;
    const start = i;
    while (i < html.length && depth > 0) {
      if (html.startsWith('<span', i)) depth++;
      else if (html.startsWith('</span>', i)) depth--;
      if (depth > 0) i++;
    }
    values.push(html.slice(start, i).replace(/<[^>]+>/g, ''));
  }
  return values.flatMap((v) => [...v.matchAll(/-?\d+(?:\.\d+)?/g)].map((n) => Number(n[0])));
}
export const ourNumbers = (mod: Pick<Mod, 'lines'>) =>
  mod.lines.flatMap((l) => l.ranges.flatMap((r) => (r.min === r.max ? [r.min] : [r.min, r.max])));
const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export type MatchResult = { readonly status: 'matched'; readonly mod: Mod } | { readonly status: 'none' } | { readonly status: 'ambiguous'; readonly ids: readonly string[] };

export function matchRow(row: Row, candidates: readonly Mod[]): MatchResult {
  const side = String(row.ModGenerationTypeID) === '1' ? 'prefix' : String(row.ModGenerationTypeID) === '2' ? 'suffix' : null;
  if (!side) return { status: 'none' };
  let hits = candidates.filter((m) => m.side === side && m.requiredItemLevel === Number(row.Level) && m.name === row.Name);
  if (hits.length > 1) {
    const numbers = JSON.stringify(rowNumbers(row.str));
    const byNumbers = hits.filter((m) => JSON.stringify(ourNumbers(m)) === numbers);
    if (byNumbers.length > 0) hits = byNumbers;
  }
  if (hits.length > 1 && row.spawn_no) {
    const rowTags = new Set(row.spawn_no);
    const byTags = hits.filter((m) => m.spawnWeights.filter((w) => w.spawns).every((w) => rowTags.has(w.tag)));
    if (byTags.length > 0) hits = byTags;
  }
  if (hits.length > 1 && row.ModFamilyList) {
    const family = [...row.ModFamilyList].sort().join('+');
    const byFamily = hits.filter((m) => [...m.groupIds].sort().join('+') === family || m.family === family);
    if (byFamily.length > 0) hits = byFamily;
  }
  if (hits.length === 1) return { status: 'matched', mod: hits[0]! };
  return hits.length === 0 ? { status: 'none' } : { status: 'ambiguous', ids: hits.map((m) => m.id) };
}

/** Table of a base: its class's pages whose tags the base carries, the most specific one. */
export function assignTable<P extends { page: string; itemClassId: string; tag: string | null }>(base: Base, pages: readonly P[]): P | 'ambiguous' | null {
  const fitting = pages.filter((p) => p.itemClassId === base.itemClassId && (p.tag ?? '').split(',').filter(Boolean).every((t) => base.tags.includes(t)));
  const size = (p: P) => (p.tag ?? '').split(',').filter(Boolean).length;
  const best = Math.max(...fitting.map(size));
  const top = fitting.filter((p) => size(p) === best);
  return top.length === 1 ? top[0]! : top.length > 1 ? 'ambiguous' : null;
}

function main() {
  const manifest = JSON.parse(readFileSync(join(RAW, 'manifest.json'), 'utf8')) as WeightManifest;
  const data = JSON.parse(readFileSync(DATA, 'utf8')) as { gameVersion: string; bases: Base[]; modifiers: Mod[] };
  const explicit = data.modifiers.filter((m) => (m.layer ?? 'explicit') === 'explicit');

  const unresolved: { page: string; side: string; level: number; name: string; text: string; reason: string; candidates?: readonly string[] }[] = [];
  const conflicts: { page: string; modifierId: string; values: string[] }[] = [];
  const tables = manifest.pages.map((page) => {
    const view = JSON.parse(readFileSync(join(RAW, `${page.page}.json`), 'utf8')) as { normal?: Row[] };
    const rows = view.normal ?? [];
    const candidates = explicit.filter((m) => data.bases.some((b) => b.itemClassId === page.itemClassId && spawnable(m, b)));
    const raw = new Map<string, string[]>();
    for (const row of rows) {
      const result = matchRow(row, candidates);
      if (result.status !== 'matched') {
        unresolved.push({
          page: page.page, side: String(row.ModGenerationTypeID), level: Number(row.Level), name: row.Name, text: plain(row.str),
          reason: result.status === 'none' ? 'no-candidate' : 'ambiguous', ...(result.status === 'ambiguous' ? { candidates: result.ids } : {}),
        });
        continue;
      }
      raw.set(result.mod.id, [...(raw.get(result.mod.id) ?? []), String(row.DropChance)]);
    }
    const entries: { modifierId: string; weight: number; rawValue: string }[] = [];
    const unmeasured: string[] = [];
    for (const [modifierId, values] of raw) {
      if (new Set(values).size > 1) {
        conflicts.push({ page: page.page, modifierId, values });
        continue;
      }
      const value = Number(values[0]);
      if (Number.isFinite(value) && value > PLACEHOLDER_MAX) entries.push({ modifierId, weight: value, rawValue: values[0]! });
      else unmeasured.push(modifierId);
    }
    entries.sort((a, b) => a.modifierId.localeCompare(b.modifierId));
    unmeasured.sort();
    return {
      id: `poe2db:${page.page}`, page: page.page, itemClassId: page.itemClassId, tag: page.tag,
      requiredTags: page.tag ? page.tag.split(',') : [], url: page.url, sha256: page.sha256,
      rows: rows.length, entries, unmeasured, bases: [] as string[],
    };
  });

  const unassigned: { baseId: string; name: string; itemClassId: string; reason: string }[] = [];
  for (const base of data.bases) {
    const table = assignTable(base, tables);
    if (table && table !== 'ambiguous') table.bases.push(base.id);
    else if (tables.some((t) => t.itemClassId === base.itemClassId)) unassigned.push({ baseId: base.id, name: base.name, itemClassId: base.itemClassId, reason: table ?? 'no-fitting-table' });
  }

  const output = {
    generatedBy: 'scripts/data/weights-normalize.ts',
    source: manifest.source,
    gamePatch: manifest.gamePatch,
    gameVersion: data.gameVersion,
    capturedAt: manifest.fetchedAt,
    placeholderMax: PLACEHOLDER_MAX,
    tables,
    unassigned,
    conflicts,
    unresolved,
  };
  writeFileSync(OUT, `${JSON.stringify(output)}\n`);
  const count = (pick: (t: (typeof tables)[number]) => number) => tables.reduce((sum, t) => sum + pick(t), 0);
  process.stdout.write(
    [
      `poe2db patch ${manifest.gamePatch ?? '?'} (dataset ${data.gameVersion}), captured ${manifest.fetchedAt}`,
      `tables ${tables.length}, rows ${count((t) => t.rows)}, weights ${count((t) => t.entries.length)}, unmeasured ${count((t) => t.unmeasured.length)}`,
      `bases assigned ${count((t) => t.bases.length)}, unassigned (class has tables) ${unassigned.length}`,
      `unresolved rows ${unresolved.length}, conflicts ${conflicts.length}`,
      `→ ${OUT}`,
    ].join('\n') + '\n',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
