import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('packages/craft-db/src/production/poe2-data.json', root), 'utf8'));
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
  baseStatuses: counts(data.bases, 'dataStatus'), modifierLayers: counts([...data.modifiers, ...data.specialModifiers], 'layer'),
  consumableCategories: counts(data.consumables, 'category'), consumableStatuses: counts(data.consumables, 'craftStatus', 'catalogued'),
  weights, hiddenSpecialModifiers: data.specialModifiers.filter((m: any) => !m.lines.length).map((m: any) => m.id),
  warnings: data.warnings,
};
const output = new URL('data/coverage-report.json', root);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\nReport: ${fileURLToPath(output)}\n`);
