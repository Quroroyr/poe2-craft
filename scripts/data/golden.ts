/** Explicitly update pinned golden cases from RePoE's independent mods_by_base calculation. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const data = read('packages/craft-db/src/production/poe2-data.json');
const reference = read('data/raw/repoe-poe2/mods_by_base.json');
const raw = read('data/raw/repoe-poe2/mods.json');
const out = new URL('packages/craft-db/src/production/golden/', root);
mkdirSync(out, { recursive: true });
for (const name of ['Akoyan Spear', 'Recurve Bow', 'Rusted Cuirass', 'Rawhide Boots', 'Topaz Ring', 'Amber Amulet']) {
  const base = data.bases.find((b: any) => b.name === name && !b.ambiguousName);
  if (!base) throw new Error(`No unambiguous base: ${name}`);
  const tagSet = Object.values(reference).flatMap((cls: any) => Object.values(cls)).find((entry: any) => entry.bases.includes(base.id)) as any;
  if (!tagSet) throw new Error(`Base absent from RePoE reference: ${base.id}`);
  const itemLevel = 82;
  const eligible: any[] = [];
  for (const side of ['prefix', 'suffix']) for (const [family, ids] of Object.entries(tagSet.mods[side] ?? {})) {
    const live = Object.entries(ids as Record<string, number>).filter(([id]) => raw[id].domain === base.domain && raw[id].text);
    const levels = [...new Set(live.map(([, level]) => level))].sort((a, b) => b - a);
    for (const [id, level] of live) if (level <= itemLevel) eligible.push({ id, side, family, tier: levels.indexOf(level) + 1, level, groups: raw[id].groups, weight: null });
  }
  eligible.sort((a, b) => a.id.localeCompare(b.id));
  const snapshot = { name, baseId: base.id, itemLevel, gameVersion: data.gameVersion, revision: data.upstream[0].revision,
    details: base.details, implicitModifierIds: base.implicitModifierIds, eligible };
  writeFileSync(new URL(`${name.toLowerCase().replaceAll(' ', '-')}.json`, out), `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(`${name}: ${eligible.length} eligible modifiers\n`);
}
