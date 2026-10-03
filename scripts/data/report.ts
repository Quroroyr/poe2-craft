/**
 * REPORT step: data/coverage-report.json — what the production dataset covers.
 *
 *   node scripts/data/report.ts             # full report
 *   node scripts/data/report.ts --weights   # write the full report, print only the weights section
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AFFIX_RULE_CATEGORIES } from '../../packages/craft-db/src/production/rules.ts';

const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('packages/craft-db/src/production/poe2-data.json', root), 'utf8'));
const mechanics = JSON.parse(readFileSync(new URL('packages/craft-db/src/production/mechanics.json', root), 'utf8'));
const weightsFile = JSON.parse(readFileSync(new URL('packages/craft-db/src/production/poe2db-weights.json', root), 'utf8'));
const classCategories = new Map(data.itemClasses.map((c: any) => [c.id, c.category]));
const bases = data.bases.map((b: any) => ({ ...b, dataStatus: !AFFIX_RULE_CATEGORIES.includes(classCategories.get(b.itemClassId) as string) ? 'unsupported' : b.dataStatus === 'validated' ? 'crafting-supported' : b.dataStatus }));
const consumables = data.consumables.map((c: any) => ({ ...c, ...mechanics.consumables[c.id] }));
const counts = (records: any[], field: string, fallback = 'unknown') => {
  const result: Record<string, number> = {};
  for (const record of records) { const key = record[field] ?? fallback; result[key] = (result[key] ?? 0) + 1; }
  return result;
};

// ---------------------------------------------------------------- weights
const explicit = data.modifiers.filter((m: any) => (m.layer ?? 'explicit') === 'explicit');
const deciding = (m: any, tags: string[]) => m.spawnWeights.find((w: any) => tags.includes(w.tag));
const pool = (base: any) => explicit.filter((m: any) => (!m.domain || m.domain === base.domain) && deciding(m, base.tags)?.spawns === true);
const tableOf = new Map<string, any>();
for (const t of weightsFile.tables) for (const id of t.bases) tableOf.set(id, t);

/** Coverage of the full explicit pool of a base (every tier, any item level): what a craft may roll. */
function baseCoverage(base: any) {
  const table = tableOf.get(base.id);
  const weighted = new Set(table ? table.entries.map((e: any) => e.modifierId) : []);
  const mods = pool(base);
  const known = mods.filter((m: any) => weighted.has(m.id)).length;
  return { table: table?.page ?? null, modifiers: mods.length, known, status: mods.length === 0 ? 'no-pool' : known === mods.length ? 'full' : known === 0 ? 'none' : 'partial' };
}
const craftable = bases.filter((b: any) => b.dataStatus === 'crafting-supported');
const coverage = craftable.map((b: any) => ({ base: b, ...baseCoverage(b) }));
const groupName = (c: any) => c.table ?? `${c.base.itemClassId} (no PoE2DB table)`;
const groups: Record<string, { bases: number; full: number; partial: number; none: number; unknownModifiers: string[] }> = {};
for (const c of coverage) {
  const g = (groups[groupName(c)] ??= { bases: 0, full: 0, partial: 0, none: 0, unknownModifiers: [] });
  g.bases++;
  if (c.status === 'full' || c.status === 'partial' || c.status === 'none') g[c.status as 'full' | 'partial' | 'none']++;
  const weighted = new Set((tableOf.get(c.base.id)?.entries ?? []).map((e: any) => e.modifierId));
  for (const m of pool(c.base)) if (!weighted.has(m.id) && !g.unknownModifiers.includes(m.id)) g.unknownModifiers.push(m.id);
}
const groupStatus = (g: any) => (g.full === g.bases ? 'fully-weighted' : g.none === g.bases ? 'unweighted' : 'partially-weighted');
const weights = {
  source: weightsFile.source.url, gamePatch: weightsFile.gamePatch, capturedAt: weightsFile.capturedAt,
  tables: weightsFile.tables.length,
  knownTotal: weightsFile.tables.reduce((s: number, t: any) => s + t.entries.length, 0),
  poe2dbCommunity: weightsFile.tables.reduce((s: number, t: any) => s + t.entries.length, 0),
  unmeasuredBySource: weightsFile.tables.reduce((s: number, t: any) => s + t.unmeasured.length, 0),
  mappingFailed: weightsFile.unresolved.length,
  conflicting: weightsFile.conflicts.length,
  basesWithTable: weightsFile.tables.reduce((s: number, t: any) => s + t.bases.length, 0),
  basesWithoutFittingTable: weightsFile.unassigned.length,
  craftableBases: { total: coverage.length, ...counts(coverage, 'status') },
  groups: Object.fromEntries(Object.entries(groups).sort().map(([name, g]) => [name, { status: groupStatus(g), bases: g.bases, full: g.full, partial: g.partial, none: g.none, unknownModifiers: g.unknownModifiers.length }])),
  fullyWeightedGroups: Object.entries(groups).filter(([, g]) => groupStatus(g) === 'fully-weighted').map(([n]) => n).sort(),
  partiallyWeightedGroups: Object.entries(groups).filter(([, g]) => groupStatus(g) === 'partially-weighted').map(([n]) => n).sort(),
  unweightedGroups: Object.entries(groups).filter(([, g]) => groupStatus(g) === 'unweighted').map(([n]) => n).sort(),
  unresolvedRows: weightsFile.unresolved.map((u: any) => `${u.page}: ${u.name} (${u.reason})`),
};

const report = {
  gameVersion: data.gameVersion, gameClientVersion: data.gameClientVersion, upstream: data.upstream,
  counts: { itemClasses: data.itemClasses.length, bases: data.bases.length, modifiers: data.modifiers.length,
    specialModifiers: data.specialModifiers.length, groups: data.groups.length, consumables: data.consumables.length },
  baseStatuses: counts(bases, 'dataStatus'), modifierLayers: counts([...data.modifiers, ...data.specialModifiers], 'layer'),
  consumableCategories: counts(consumables, 'category'), consumableStatuses: counts(consumables, 'craftStatus', 'catalogued'),
  actions: mechanics.actions.map((a: any) => a.id), modelledConsumables: consumables.filter((c: any) => c.craftStatus === 'modelled').map((c: any) => c.id),
  weights, hiddenSpecialModifiers: data.specialModifiers.filter((m: any) => !m.lines.length).map((m: any) => m.id),
  warnings: data.warnings,
};
const output = new URL('data/coverage-report.json', root);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
const shown = process.argv.includes('--weights') ? { weights } : report;
process.stdout.write(`${JSON.stringify(shown, null, 2)}\nReport: ${fileURLToPath(output)}\n`);
