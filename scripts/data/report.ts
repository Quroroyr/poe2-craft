import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AFFIX_RULE_CATEGORIES } from '../../packages/craft-db/src/production/rules.ts';

const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('packages/craft-db/src/production/poe2-data.json', root), 'utf8'));
const mechanics = JSON.parse(readFileSync(new URL('packages/craft-db/src/production/mechanics.json', root), 'utf8'));
const classCategories = new Map(data.itemClasses.map((c: any) => [c.id, c.category]));
const bases = data.bases.map((b: any) => ({ ...b, dataStatus: !AFFIX_RULE_CATEGORIES.includes(classCategories.get(b.itemClassId) as string) ? 'unsupported' : b.dataStatus === 'validated' ? 'crafting-supported' : b.dataStatus }));
const consumables = data.consumables.map((c: any) => ({ ...c, ...mechanics.consumables[c.id] }));
const counts = (records: any[], field: string, fallback = 'unknown') => {
  const result: Record<string, number> = {};
  for (const record of records) { const key = record[field] ?? fallback; result[key] = (result[key] ?? 0) + 1; }
  return result;
};
const weights = { known: 0, community: 0, unknown: 0, forbidden: 0 };
for (const mod of [...data.modifiers, ...data.specialModifiers]) for (const w of mod.spawnWeights) {
  if (w.spawns === false) { weights.forbidden++; continue; }
  if (w.weight === null) weights.unknown++;
  else if (['recombinator-observation', 'trade-observation', 'community-estimate'].includes(w.evidence?.method)) weights.community++;
  else weights.known++;
}
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
process.stdout.write(`${JSON.stringify(report, null, 2)}\nReport: ${fileURLToPath(output)}\n`);
