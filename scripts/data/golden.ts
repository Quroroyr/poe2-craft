/**
 * Explicitly update pinned golden cases.
 *
 * Applicability comes from RePoE's independent mods_by_base calculation. Weights come straight from
 * the raw PoE2DB page of the base (class page, or the attribute page named after the base's
 * `*_armour` tag), matched by side + level + affix name + spawn tags — not through
 * weights-normalize.ts or the spawn-tag attachment, so a mapping regression shows up as a diff.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const data = read('packages/craft-db/src/production/poe2-data.json');
const reference = read('data/raw/repoe-poe2/mods_by_base.json');
const raw = read('data/raw/repoe-poe2/mods.json');
const weightManifest = read('data/raw/poe2db/manifest.json');
const out = new URL('packages/craft-db/src/production/golden/', root);
mkdirSync(out, { recursive: true });

function pageFor(base: any): any {
  const pages = weightManifest.pages.filter((p: any) => p.itemClassId === base.itemClassId);
  const attribute = base.tags.find((t: string) => /^(str|dex|int)(_(str|dex|int))*_armour$/.test(t));
  const page = pages.length === 1 ? pages[0] : pages.find((p: any) => p.tag?.split(',')[0] === attribute);
  if (!page) throw new Error(`No PoE2DB page for ${base.name}`);
  return { ...page, rows: read(`data/raw/poe2db/${page.page}.json`).normal };
}

for (const name of ['Akoyan Spear', 'Recurve Bow', 'Rusted Cuirass', 'Rawhide Boots', 'Topaz Ring', 'Amber Amulet']) {
  const base = data.bases.find((b: any) => b.name === name && !b.ambiguousName);
  if (!base) throw new Error(`No unambiguous base: ${name}`);
  const tagSet = Object.values(reference).flatMap((cls: any) => Object.values(cls)).find((entry: any) => entry.bases.includes(base.id)) as any;
  if (!tagSet) throw new Error(`Base absent from RePoE reference: ${base.id}`);
  const page = pageFor(base);
  const weightOf = (id: string, side: string) => {
    const mod = raw[id];
    const spawnTags = mod.spawn_weights.filter((w: any) => w.weight > 0).map((w: any) => w.tag);
    const rows = page.rows.filter((r: any) => r.Name === mod.name && Number(r.Level) === mod.required_level &&
      String(r.ModGenerationTypeID) === (side === 'prefix' ? '1' : '2') && spawnTags.every((t: string) => r.spawn_no.includes(t)));
    if (rows.length !== 1) return null;
    const value = Number(rows[0].DropChance);
    return value > 1 ? value : null;
  };
  const itemLevel = 82;
  const eligible: any[] = [];
  for (const side of ['prefix', 'suffix']) for (const [family, ids] of Object.entries(tagSet.mods[side] ?? {})) {
    const live = Object.entries(ids as Record<string, number>).filter(([id]) => raw[id].domain === base.domain && raw[id].text);
    const levels = [...new Set(live.map(([, level]) => level))].sort((a, b) => b - a);
    for (const [id, level] of live) if (level <= itemLevel) eligible.push({ id, side, family, tier: levels.indexOf(level) + 1, level, groups: raw[id].groups, weight: weightOf(id, side) });
  }
  eligible.sort((a, b) => a.id.localeCompare(b.id));
  const sum = (side?: string) => eligible.filter((e) => !side || e.side === side).reduce((s, e) => s + (e.weight ?? 0), 0);
  const unknown = eligible.filter((e) => e.weight === null).map((e) => e.id);
  const weights = {
    source: 'poe2db-weightings', page: page.page, patch: weightManifest.gamePatch, capturedAt: weightManifest.fetchedAt.slice(0, 10),
    fullyWeighted: unknown.length === 0, unknown,
    total: sum(), prefixTotal: sum('prefix'), suffixTotal: sum('suffix'),
  };
  const snapshot = { name, baseId: base.id, itemLevel, gameVersion: data.gameVersion, revision: data.upstream[0].revision,
    details: base.details, implicitModifierIds: base.implicitModifierIds, weights, eligible };
  writeFileSync(new URL(`${name.toLowerCase().replaceAll(' ', '-')}.json`, out), `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(`${name}: ${eligible.length} eligible, page ${page.page}, total ${weights.total} (P ${weights.prefixTotal} / S ${weights.suffixTotal}), unknown ${unknown.length}\n`);
}
