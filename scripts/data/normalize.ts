/**
 * NORMALIZE step:  data/raw (RePoE PoE 2 export + official trade2)  →  packages/craft-db/src/production/poe2-data.json
 *
 * Only extracted facts go into the generated file: classes, bases, modifiers (explicit, desecrated,
 * implicit, corruption enchants), collision groups, consumables. Hand-modelled rules (affix limits,
 * actions, omen scopes, quality) live in packages/craft-db/src/production/rules.ts and never here.
 *
 * Rules applied, all derived from the data itself:
 * - a class is "equipment" when at least one of its released bases can spawn an explicit
 *   prefix/suffix of its own domain, and the official trade lists its bases as weapon / armour /
 *   accessory / jewel / flask; classes without a display name are left out;
 * - a base is `validated` when the official trade list knows its name, otherwise `imported`;
 *   copies with the same name and identical tags / properties / implicits collapse into one record;
 * - spawn weights in the client are only 0 / 1: they become `spawns: true|false` with `weight: null`
 *   (the real weight is unknown — never 0, an average or a fixture value);
 * - family = the modifier `type`; tiers are computed per base by the engine, not stored.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT_DIR = join(ROOT, 'packages', 'craft-db', 'src', 'production');
const OUT = join(OUT_DIR, 'poe2-data.json');

const read = <T>(path: string): T => JSON.parse(readFileSync(join(RAW, path), 'utf8')) as T;

interface RawMod {
  domain: string;
  generation_type: string;
  groups: string[];
  implicit_tags: string[];
  name: string;
  required_level: number;
  spawn_weights: { tag: string; weight: number }[];
  stats: { id: string; min: number; max: number }[];
  text?: string;
  type: string;
  is_essence_only?: boolean;
}
interface RawBase {
  domain: string;
  drop_level: number;
  implicits: string[];
  item_class: string;
  name: string;
  properties: Record<string, unknown> | null;
  release_state: string;
  tags: string[];
  visual_identity?: { dds_file?: string; id?: string };
  requirements: { dexterity?: number; intelligence?: number; level?: number; strength?: number } | null;
}
interface RawClass {
  name: string;
  category: string | null;
  category_id: string | null;
}
interface TradeGroup {
  id: string;
  label: string | null;
  entries: { id?: string; text?: string; type?: string; name?: string; image?: string; flags?: { unique?: boolean } }[];
}
interface Manifest {
  sources: { id: string; revision: string | null; gameClientVersion: string | null; fetchedAt: string; repository?: string }[];
}

const manifest = read<Manifest>('manifest.json');
const repoeSource = manifest.sources.find((s) => s.id === 'repoe-poe2');
const tradeSource = manifest.sources.find((s) => s.id === 'official-trade2');
if (!repoeSource?.gameClientVersion || !tradeSource) throw new Error('run `pnpm data:fetch` first');

const CLIENT = repoeSource.gameClientVersion; // e.g. 4.5.5.2
const [, minor, patch] = CLIENT.split('.');
/** Client 4.<minor>.<patch>.<hotfix> ↔ PoE 2 0.<minor>.<patch> (see docs/research/real-data-landscape.md). */
const GAME_VERSION = `0.${minor}.${patch}`;
const VERSIONS = { introducedIn: GAME_VERSION };
const DAY = repoeSource.fetchedAt.slice(0, 10);
const GAME_DATA = { sourceId: 'repoe-poe2', confidence: 'verified', lastVerified: DAY } as const;
const TRADE = { sourceId: 'official-trade2', confidence: 'official', lastVerified: tradeSource.fetchedAt.slice(0, 10) } as const;

const mods = read<Record<string, RawMod>>('repoe-poe2/mods.json');
const bases = read<Record<string, RawBase>>('repoe-poe2/base_items.json');
const classes = read<Record<string, RawClass>>('repoe-poe2/item_classes.json');
const tradeItems = read<{ result: TradeGroup[] }>('trade2/items.json').result;
const tradeStatic = read<{ result: TradeGroup[] }>('trade2/static.json').result;

// ---------------------------------------------------------------- text → template lines
const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const RANGE = new RegExp(String.raw`\((${NUMBER})-(${NUMBER})\)`, 'g');

/** "[Attack]" → "Attack", "[Physical|Physical]" → "Physical": game markup to display text. */
function plain(text: string): string {
  return text.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1');
}

/** "+(80-89) to maximum Mana" → { template: "+# to maximum Mana", ranges: [{80, 89}] }. */
function lines(text: string | undefined) {
  if (!text) return [];
  return plain(text)
    .split('\n')
    .map((line) => {
      const ranges: { min: number; max: number }[] = [];
      const template = line.replace(RANGE, (_m, a: string, b: string) => {
        ranges.push({ min: Math.min(Number(a), Number(b)), max: Math.max(Number(a), Number(b)) });
        return '#';
      });
      return { template, ranges };
    });
}

/** Display line with ranges, e.g. "(25–35)% increased Projectile Speed". */
function displayText(text: string | undefined): string {
  return text ? plain(text).replace(RANGE, (_m, a: string, b: string) => (a === b ? a : `(${a}–${b})`)) : '';
}

// ---------------------------------------------------------------- classes and bases
const SLOT_GENERATIONS = new Set(['prefix', 'suffix']);
const spawns = (mod: RawMod, tags: readonly string[]) => {
  for (const w of mod.spawn_weights) if (tags.includes(w.tag)) return w.weight > 0;
  return false;
};
const explicitByDomain = new Map<string, RawMod[]>();
for (const mod of Object.values(mods)) {
  if (!SLOT_GENERATIONS.has(mod.generation_type)) continue;
  explicitByDomain.set(mod.domain, [...(explicitByDomain.get(mod.domain) ?? []), mod]);
}

const released = Object.entries(bases).filter(([, b]) => b.release_state === 'released' && b.name);
const equipmentClasses = new Set<string>();
for (const [, b] of released) {
  if (!classes[b.item_class]?.name) continue;
  if ((explicitByDomain.get(b.domain) ?? []).some((m) => spawns(m, b.tags))) equipmentClasses.add(b.item_class);
}

/** Trade group of every base type name → class category ("weapon", "armour", "accessory", "jewel", "flask"). */
const tradeGroupOf = new Map<string, string>();
for (const group of tradeItems) for (const e of group.entries) if (e.type && !e.flags?.unique) tradeGroupOf.set(e.type, group.id);

const classCategory = new Map<string, string>();
for (const cls of equipmentClasses) {
  const counts = new Map<string, number>();
  for (const [, b] of released) if (b.item_class === cls) {
    const g = tradeGroupOf.get(b.name);
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  classCategory.set(cls, best?.[0] ?? 'other');
}

/** Equipment by the official trade grouping; classes the trade does not list (unreleased claws, heist, maps…) stay out. */
const EQUIPMENT_GROUPS = new Set(['weapon', 'armour', 'accessory', 'jewel', 'flask']);
for (const cls of [...equipmentClasses]) if (!EQUIPMENT_GROUPS.has(classCategory.get(cls) ?? '')) equipmentClasses.delete(cls);

const itemClasses = [...equipmentClasses].sort().map((id) => ({
  id,
  name: classes[id]!.name,
  clipboardName: classes[id]!.name,
  category: classCategory.get(id),
  versions: VERSIONS,
  provenance: GAME_DATA,
}));

function properties(p: Record<string, unknown> | null) {
  const out: { name: string; value: string }[] = [];
  if (!p) return out;
  const n = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  const range = (k: string) => {
    const v = p[k] as { min: number; max: number } | null;
    return v && typeof v === 'object' ? (v.min === v.max ? String(v.min) : `${v.min}-${v.max}`) : null;
  };
  if (n('physical_damage_min') !== null && n('physical_damage_max') !== null) out.push({ name: 'Physical Damage', value: `${n('physical_damage_min')}-${n('physical_damage_max')}` });
  if (n('critical_strike_chance') !== null) out.push({ name: 'Critical Hit Chance', value: `${(n('critical_strike_chance')! / 100).toFixed(2)}%` });
  if (n('attack_time')) out.push({ name: 'Attacks per Second', value: (1000 / n('attack_time')!).toFixed(2) });
  for (const [key, name] of [['armour', 'Armour'], ['evasion', 'Evasion Rating'], ['energy_shield', 'Energy Shield'], ['ward', 'Ward']] as const) {
    const v = range(key);
    if (v && v !== '0') out.push({ name, value: v });
  }
  if (n('block')) out.push({ name: 'Block chance', value: `${n('block')}%` });
  if (n('movement_speed')) out.push({ name: 'Movement Speed', value: `${n('movement_speed')! / 100}%` });
  if (n('life_per_use')) out.push({ name: 'Recovers Life', value: String(n('life_per_use')) });
  if (n('mana_per_use')) out.push({ name: 'Recovers Mana', value: String(n('mana_per_use')) });
  if (n('charges_max')) out.push({ name: 'Charges', value: `${n('charges_per_use') ?? '?'}/${n('charges_max')}` });
  return out;
}

function requirements(r: RawBase['requirements']) {
  const out: Record<string, number> = {};
  if (!r) return out;
  for (const k of ['level', 'strength', 'dexterity', 'intelligence'] as const) if (r[k]) out[k] = r[k]!;
  return out;
}

const tradeNames = new Set(tradeGroupOf.keys());
const equipment = released.filter(([, b]) => equipmentClasses.has(b.item_class));
const signature = (b: RawBase) => JSON.stringify([b.item_class, [...b.tags].sort(), properties(b.properties), [...b.implicits].sort(), requirements(b.requirements)]);

const byName = new Map<string, [string, RawBase][]>();
for (const entry of equipment) byName.set(entry[1].name, [...(byName.get(entry[1].name) ?? []), entry]);

const collapsed: { id: string; base: RawBase; aliases: string[]; ambiguousName: boolean }[] = [];
for (const [, entries] of byName) {
  const groups = new Map<string, [string, RawBase][]>();
  for (const e of entries) groups.set(signature(e[1]), [...(groups.get(signature(e[1])) ?? []), e]);
  for (const group of groups.values()) {
    const [first, ...rest] = [...group].sort((a, b) => a[0].localeCompare(b[0]));
    collapsed.push({ id: first![0], base: first![1], aliases: rest.map((r) => r[0]), ambiguousName: groups.size > 1 });
  }
}

const implicitIds = new Set<string>();
const productionBases = collapsed
  .sort((a, b) => a.base.item_class.localeCompare(b.base.item_class) || a.base.drop_level - b.base.drop_level || a.base.name.localeCompare(b.base.name))
  .map(({ id, base, aliases, ambiguousName }) => {
    base.implicits.forEach((i) => implicitIds.add(i));
    const art = base.visual_identity?.dds_file?.replace(/\.dds$/i, '');
    return {
      id,
      name: base.name,
      itemClassId: base.item_class,
      domain: base.domain,
      tags: base.tags,
      dropLevel: base.drop_level,
      ...(art ? { artAssetId: art } : {}),
      implicitModifierIds: base.implicits,
      dataStatus: tradeNames.has(base.name) ? 'validated' : 'imported',
      ...(aliases.length ? { aliases } : {}),
      ...(ambiguousName ? { ambiguousName: true } : {}),
      details: {
        properties: properties(base.properties),
        requirements: requirements(base.requirements),
        implicits: base.implicits.map((i) => displayText(mods[i]?.text)).filter(Boolean),
        provenance: GAME_DATA,
      },
      versions: VERSIONS,
      provenance: GAME_DATA,
    };
  });

// ---------------------------------------------------------------- modifiers
const warnings: string[] = [];
const equipmentDomains = new Set(productionBases.map((b) => b.domain));
const groupNames = new Map<string, { level: number; text: string }>();
const toDefinition = (id: string, mod: RawMod, layer: string) => {
  for (const g of mod.groups) {
    const prev = groupNames.get(g);
    if (!prev || mod.required_level > prev.level) groupNames.set(g, { level: mod.required_level, text: lines(mod.text).map((l) => l.template).join(' / ') });
  }
  return {
    id,
    name: mod.name ?? '',
    family: mod.type,
    layer,
    // RePoE's desecrated domain describes the crafting layer; these mods live on item bases.
    domain: mod.domain === 'desecrated' ? 'item' : mod.domain,
    groupIds: mod.groups,
    requiredItemLevel: mod.required_level,
    modifierLevel: mod.required_level,
    lines: lines(mod.text),
    statIds: mod.stats.map((s) => s.id),
    spawnWeights: mod.spawn_weights.map((w) => ({ tag: w.tag, weight: null, spawns: w.weight > 0 })),
    tags: mod.implicit_tags,
    versions: VERSIONS,
    provenance: GAME_DATA,
  };
};

const slotModifiers = Object.entries(mods)
  .filter(([, m]) => SLOT_GENERATIONS.has(m.generation_type) && (equipmentDomains.has(m.domain) || m.domain === 'desecrated'))
  // Desecrated mods include map / tablet ones; keep only those that can appear on equipment tags.
  .filter(([, m]) => m.domain !== 'desecrated' || productionBases.some((b) => spawns(m, b.tags)))
  .map(([id, m]) => ({ ...toDefinition(id, m, m.domain === 'desecrated' ? 'desecrated' : 'explicit'), side: m.generation_type, tier: 0 }))
  // A modifier without display text can be neither shown nor matched: reported, not imported.
  .filter((m) => {
    if (m.lines.length > 0) return true;
    warnings.push(`modifier ${m.id}: no stat text in the export — left out`);
    return false;
  });

// Global tier = rank inside the family by level over all its tiers (informative; the engine ranks per base).
const familyLevels = new Map<string, number[]>();
for (const m of slotModifiers) familyLevels.set(`${m.layer}|${m.side}|${m.family}`, [...(familyLevels.get(`${m.layer}|${m.side}|${m.family}`) ?? []), m.requiredItemLevel]);
for (const m of slotModifiers) {
  const levels = [...new Set(familyLevels.get(`${m.layer}|${m.side}|${m.family}`))].sort((a, b) => b - a);
  m.tier = levels.indexOf(m.requiredItemLevel) + 1;
}

const specialModifiers = Object.entries(mods)
  .filter(([id, m]) => implicitIds.has(id) || (m.generation_type === 'corrupted' && equipmentDomains.has(m.domain)))
  .map(([id, m]) => toDefinition(id, m, implicitIds.has(id) ? 'implicit' : 'corruption'));

const groups = [...groupNames].sort((a, b) => a[0].localeCompare(b[0])).map(([id, g]) => ({ id, name: g.text || id, provenance: GAME_DATA }));

// ---------------------------------------------------------------- consumables (official trade groups)
/** (trade group, section) → category. Sections without a category are not crafting materials. */
const CONSUMABLE_SECTIONS: Record<string, Record<string, string>> = {
  Currency: { '-': 'currency', '': 'currency' },
  Runes: { '-': 'rune', '': 'rune' },
  Essences: { '-': 'essence', '': 'essence' },
  Ritual: { Omens: 'omen' },
  Breach: { Catalysts: 'catalyst' },
  Delirium: { 'Liquid Emotions': 'liquid-emotion' },
  Abyss: { '-': 'abyssal-bone' },
  Vaal: { '-': 'currency', 'Soul Cores': 'soul-core', Augments: 'rune' },
};

/** The CDN image URL embeds the art path: "/gen/image/<base64 [25,14,{f:'2DItems/…'}]>/…" → "Art/2DItems/…". */
function artFromImage(image: string | undefined): string | undefined {
  const token = image?.split('/')[3];
  if (!token) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as [number, number, { f: string }];
    return `Art/${decoded[2].f}`;
  } catch {
    return undefined;
  }
}

const consumables: Record<string, unknown>[] = [];
for (const group of tradeStatic) {
  const sections = CONSUMABLE_SECTIONS[group.id];
  if (!sections) continue;
  let section = '-';
  for (const e of group.entries) {
    if (e.id === 'sep') {
      section = e.text ?? '';
      continue;
    }
    const category = sections[section];
    if (!category || !e.id || !e.text) continue;
    const art = artFromImage(e.image);
    consumables.push({
      id: e.id,
      name: e.text,
      category,
      craftStatus: 'catalogued',
      ...(art ? { art } : {}),
      tradeGroup: group.id,
      versions: VERSIONS,
      provenance: TRADE,
    });
  }
}

// ---------------------------------------------------------------- write
const dataset = {
  generatedBy: 'scripts/data/normalize.ts',
  gameVersion: GAME_VERSION,
  gameClientVersion: CLIENT,
  upstream: manifest.sources.map((s) => ({ id: s.id, revision: s.revision, fetchedAt: s.fetchedAt, repository: s.repository ?? null })),
  itemClasses,
  bases: productionBases,
  groups,
  modifiers: slotModifiers,
  specialModifiers,
  consumables,
  warnings,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(dataset)}\n`);
process.stdout.write(
  [
    `game ${GAME_VERSION} (client ${CLIENT})`,
    `item classes ${itemClasses.length}`,
    `bases ${productionBases.length} (validated ${productionBases.filter((b) => b.dataStatus === 'validated').length})`,
    `slot modifiers ${slotModifiers.length} (desecrated ${slotModifiers.filter((m) => m.layer === 'desecrated').length})`,
    `special modifiers ${specialModifiers.length}`,
    `groups ${groups.length}`,
    `consumables ${consumables.length}`,
    `warnings ${warnings.length}`,
    `→ ${OUT} (${(readFileSync(OUT).length / 1024 / 1024).toFixed(2)} MB)`,
  ].join('\n') + '\n',
);
