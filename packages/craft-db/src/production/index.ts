/**
 * The production CraftDataset: generated facts (`poe2-data.json`) + hand-modelled rules (`rules.ts`).
 * Base support status is decided here, from the rules: a validated base whose class has known
 * affix limits is `crafting-supported`; a class without them is `unsupported`.
 */
import type {
  Consumable,
  CraftAction,
  ItemBase,
  ItemClass,
  ModifierDefinition,
  ModifierGroup,
  SpecialModifierDefinition,
} from '@poe2-craft/craft-domain';
import type { CraftDataset } from '../dataset';
import data from './poe2-data.json';
import mechanics from './mechanics.json';
import { RULES_SOURCE_ID } from './rules';
import { AFFIX_RULE_CATEGORIES, PRODUCTION_SOURCES, QUALITY_CATEGORIES, QUALITY_RULE, affixLimitRules } from './rules';

interface GeneratedData {
  readonly gameVersion: string;
  readonly gameClientVersion: string;
  readonly upstream: readonly { id: string; revision: string | null; fetchedAt: string }[];
  readonly itemClasses: readonly ItemClass[];
  readonly bases: readonly ItemBase[];
  readonly groups: readonly ModifierGroup[];
  readonly modifiers: readonly ModifierDefinition[];
  readonly specialModifiers: readonly SpecialModifierDefinition[];
  readonly consumables: readonly Consumable[];
  readonly warnings: readonly string[];
}

/** The generated JSON, typed. Its shape is checked by `validateDataset` when the CraftDB is built. */
export const PRODUCTION_DATA = data as unknown as GeneratedData;

function buildProductionDataset(generated: GeneratedData): CraftDataset {
  const ruledClasses = generated.itemClasses.filter((c) => AFFIX_RULE_CATEGORIES.includes(c.category ?? '')).map((c) => c.id);
  const categoryOf = new Map(generated.itemClasses.map((c) => [c.id, c.category ?? '']));
  const repoe = generated.upstream.find((u) => u.id === 'repoe-poe2');

  const bases = generated.bases.map((base): ItemBase => {
    const ruled = ruledClasses.includes(base.itemClassId);
    const dataStatus = !ruled ? 'unsupported' : base.dataStatus === 'validated' ? 'crafting-supported' : base.dataStatus;
    const quality = QUALITY_CATEGORIES.includes(categoryOf.get(base.itemClassId) ?? '');
    return { ...base, dataStatus, ...(quality ? { setup: { quality: QUALITY_RULE } } : {}) };
  });
  const provenance = { sourceId: RULES_SOURCE_ID, confidence: 'community' as const, lastVerified: '2026-10-02' };
  const versions = { introducedIn: generated.gameVersion };
  const actions = mechanics.actions.map((a) => ({ ...a, versions, provenance })) as unknown as CraftAction[];
  const metadata = mechanics.consumables as unknown as Record<string, Partial<Consumable>>;
  const consumables = generated.consumables.map((c): Consumable => {
    const meta = metadata[c.id];
    return { ...c, ...meta, ...(meta?.modifies ? { modifies: { ...meta.modifies, provenance } } : {}) };
  });

  return {
    info: {
      id: `poe2-${generated.gameClientVersion}`,
      title: `PoE 2 ${generated.gameVersion} — client data ${generated.gameClientVersion}`,
      kind: 'production',
      description:
        `Extracted from the game client (RePoE export ${repoe?.revision?.slice(0, 10) ?? '?'}, fetched ${repoe?.fetchedAt.slice(0, 10) ?? '?'}). ` +
        'Modifier spawn weights are not in the client: they are unknown here, so chances that need them are not calculated.',
      gameVersions: [generated.gameVersion],
      sources: PRODUCTION_SOURCES,
    },
    itemClasses: generated.itemClasses,
    bases,
    groups: generated.groups,
    modifiers: generated.modifiers,
    specialModifiers: generated.specialModifiers,
    actions,
    targets: [],
    affixLimits: affixLimitRules(ruledClasses, generated.gameVersion),
    consumables,
  };
}

export const productionDataset: CraftDataset = buildProductionDataset(PRODUCTION_DATA);
