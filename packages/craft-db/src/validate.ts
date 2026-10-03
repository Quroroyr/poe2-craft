import { isSpawnable, modifyAction, rangesOverlap, resolveSpawnWeight, sameDomain, type Provenance, type VersionRange } from '@poe2-craft/craft-domain';
import type { CraftDataset } from './dataset';

/**
 * Weight tables: every weight positive, with evidence that is not a fixture in production; one value
 * per modifier per table; unmeasured modifiers carry no number; each weighted modifier can spawn on
 * at least one base of the table; a base belongs to a table of its class whose tags it carries.
 */
function checkWeightTables(dataset: CraftDataset, problems: string[], checkProvenance: (where: string, p: Provenance) => void): void {
  const tables = new Map((dataset.weightTables ?? []).map((t) => [t.id, t] as const));
  const modifiers = new Map(dataset.modifiers.map((m) => [m.id, m] as const));
  const classIds = new Set(dataset.itemClasses.map((c) => c.id));
  const basesOf = new Map<string, typeof dataset.bases>();
  for (const base of dataset.bases) {
    if (base.weightTableId === undefined) continue;
    const table = tables.get(base.weightTableId);
    const where = `base ${base.id}`;
    if (!table) { problems.push(`${where}: unknown weight table "${base.weightTableId}"`); continue; }
    if (table.itemClassId !== base.itemClassId) problems.push(`${where}: weight table ${table.id} is for class ${table.itemClassId}`);
    if (!table.requiredTags.every((t) => base.tags.includes(t))) problems.push(`${where}: lacks the tags of weight table ${table.id}`);
    basesOf.set(table.id, [...(basesOf.get(table.id) ?? []), base]);
  }
  for (const table of tables.values()) {
    const where = `weight table ${table.id}`;
    if (!classIds.has(table.itemClassId)) problems.push(`${where}: unknown item class "${table.itemClassId}"`);
    checkProvenance(`${where} evidence`, table.evidence);
    if (dataset.info.kind === 'production' && ['fixture', 'unknown'].includes(table.evidence.method)) problems.push(`${where}: invalid production weight evidence method`);
    const seen = new Set<string>();
    const unmeasured = new Set(table.unmeasured);
    const bases = basesOf.get(table.id) ?? [];
    for (const entry of table.entries) {
      const mod = modifiers.get(entry.modifierId);
      if (seen.has(entry.modifierId)) problems.push(`${where}: duplicate weight for ${entry.modifierId}`);
      seen.add(entry.modifierId);
      if (!mod) { problems.push(`${where}: unknown modifier ${entry.modifierId}`); continue; }
      if (!Number.isFinite(entry.weight) || entry.weight <= 0) problems.push(`${where}: invalid weight ${entry.weight} for ${entry.modifierId}`);
      if (unmeasured.has(entry.modifierId)) problems.push(`${where}: ${entry.modifierId} is both weighted and unmeasured`);
      if (bases.length > 0 && !bases.some((b) => sameDomain(mod.domain, b.domain) && isSpawnable(resolveSpawnWeight(mod, b.tags)))) {
        problems.push(`${where}: weight for ${entry.modifierId}, which cannot spawn on any base of the table`);
      }
    }
    for (const id of unmeasured) if (!modifiers.has(id)) problems.push(`${where}: unknown unmeasured modifier ${id}`);
  }
}

interface Versioned {
  readonly id: string;
  readonly versions: VersionRange;
}

/**
 * Structural checks on a dataset. Returns human-readable problems; empty array = valid.
 * Catching broken references here keeps the engines free of defensive data checks.
 */
export function validateDataset(dataset: CraftDataset): string[] {
  const problems: string[] = [];
  const sourceIds = new Set(dataset.info.sources.map((s) => s.id));
  const classIds = new Set(dataset.itemClasses.map((c) => c.id));
  const groupIds = new Set(dataset.groups.map((g) => g.id));
  const modifierIds = new Set(dataset.modifiers.map((m) => m.id));
  const consumableIds = new Set(dataset.consumables.map((c) => c.id));
  const specialIds = new Set((dataset.specialModifiers ?? []).filter((m) => m.layer === 'implicit').map((m) => m.id));
  const fixtureSources = new Set(dataset.info.sources.filter((s) => s.kind === 'fixture').map((s) => s.id));

  const checkProvenance = (where: string, provenance: Provenance) => {
    if (!sourceIds.has(provenance.sourceId)) {
      problems.push(`${where}: unknown source "${provenance.sourceId}"`);
    }
    if (dataset.info.kind === 'production' && fixtureSources.has(provenance.sourceId)) {
      problems.push(`${where}: production cannot reference a fixture source`);
    }
  };

  checkRevisions('item class', dataset.itemClasses, problems);
  checkRevisions('base', dataset.bases, problems);
  checkRevisions('modifier', dataset.modifiers, problems);
  checkRevisions('action', dataset.actions, problems);
  checkRevisions('consumable', dataset.consumables, problems);
  checkRevisions('special modifier', dataset.specialModifiers ?? [], problems);
  checkRevisions('weight table', dataset.weightTables ?? [], problems);
  for (const [kind, records] of [['source', dataset.info.sources], ['group', dataset.groups], ['target', dataset.targets]] as const) {
    const ids = new Set<string>();
    for (const record of records) {
      if (ids.has(record.id)) problems.push(`${kind} ${record.id}: duplicate id`);
      ids.add(record.id);
    }
  }

  for (const c of dataset.itemClasses) checkProvenance(`item class ${c.id}`, c.provenance);
  for (const g of dataset.groups) checkProvenance(`group ${g.id}`, g.provenance);

  for (const base of dataset.bases) {
    const where = `base ${base.id}`;
    checkProvenance(where, base.provenance);
    if (!classIds.has(base.itemClassId)) {
      problems.push(`${where}: unknown item class "${base.itemClassId}"`);
    }
    if (base.details) checkProvenance(`${where} details`, base.details.provenance);
    for (const id of base.implicitModifierIds ?? []) {
      if (!specialIds.has(id)) problems.push(`${where}: unknown implicit modifier "${id}"`);
    }
    const quality = base.setup?.quality;
    if (quality) {
      checkProvenance(`${where} quality rule`, quality.provenance);
      if (!Number.isInteger(quality.min) || !Number.isInteger(quality.max) || quality.min < 0 || quality.min > quality.max) {
        problems.push(`${where}: invalid quality range ${quality.min}..${quality.max}`);
      }
    }
    const kinds = new Set<string>();
    for (const slot of base.setup?.slots ?? []) {
      checkProvenance(`${where} slot rule ${slot.kind}`, slot.provenance);
      if (kinds.has(slot.kind)) problems.push(`${where}: duplicate slot rule "${slot.kind}"`);
      kinds.add(slot.kind);
      const sorted = slot.options.every((n, i) => i === 0 || n > (slot.options[i - 1] ?? -1));
      if (slot.options.length === 0 || !sorted || slot.options.some((n) => !Number.isInteger(n) || n < 0)) {
        problems.push(`${where}: slot "${slot.kind}" needs ascending non-negative integer options`);
      }
    }
  }

  for (const mod of [...dataset.modifiers, ...(dataset.specialModifiers ?? [])]) {
    const where = `modifier ${mod.id}`;
    checkProvenance(where, mod.provenance);
    if ('side' in mod) {
      if (mod.side !== 'prefix' && mod.side !== 'suffix') problems.push(`${where}: invalid side`);
      if (!Number.isInteger(mod.tier) || mod.tier <= 0) problems.push(`${where}: invalid tier`);
      if (mod.layer !== undefined && mod.layer !== 'explicit' && mod.layer !== 'desecrated') problems.push(`${where}: invalid layer`);
      if (mod.groupIds.length === 0) problems.push(`${where}: has no modifier group`);
    } else if (mod.layer !== 'implicit' && mod.layer !== 'corruption') {
      problems.push(`${where}: invalid special layer`);
    }
    for (const g of mod.groupIds) {
      if (!groupIds.has(g)) problems.push(`${where}: unknown group "${g}"`);
    }
    // Hidden base mechanics have stat ids but no display text in the client. Preserve their ids.
    if (mod.lines.length === 0 && ('side' in mod || !mod.statIds?.length)) problems.push(`${where}: has no lines`);
    for (const line of mod.lines) {
      const placeholders = (line.template.match(/#/g) ?? []).length;
      if (placeholders !== line.ranges.length) {
        problems.push(
          `${where}: template "${line.template}" has ${placeholders} "#" but ${line.ranges.length} ranges`,
        );
      }
      for (const r of line.ranges) {
        if (!Number.isFinite(r.min) || !Number.isFinite(r.max) || r.min > r.max) problems.push(`${where}: range ${r.min}..${r.max} is invalid`);
      }
    }
    for (const w of mod.spawnWeights) {
      if (w.weight !== null && (!Number.isFinite(w.weight) || w.weight < 0)) {
        problems.push(`${where}: invalid weight ${w.weight} for tag "${w.tag}"`);
      }
      if (dataset.info.kind === 'production' && w.weight !== null && !w.evidence) problems.push(`${where}: numeric production weight needs evidence`);
      if (w.evidence) {
        checkProvenance(`${where} weight evidence`, w.evidence);
        if (dataset.info.kind === 'production' && (w.evidence.method === 'fixture' || (w.weight !== null && w.evidence.method === 'unknown'))) problems.push(`${where}: invalid production weight evidence method`);
      }
    }
  }

  checkWeightTables(dataset, problems, checkProvenance);

  for (const action of dataset.actions) {
    checkProvenance(`action ${action.id}`, action.provenance);
    const where = `action ${action.id}`;
    for (const n of [action.requirements.minModifiers, action.requirements.maxModifiers]) if (n !== undefined && (!Number.isInteger(n) || n < 0)) problems.push(`${where}: invalid modifier count requirement`);
    if (action.effect.kind === 'operations') {
      if (!action.effect.operations.length) problems.push(`${where}: empty operations`);
      for (const op of action.effect.operations) {
        if (!['set-rarity', 'add-random-mod', 'remove-random-mod', 'reroll-values', 'fracture-random-mod', 'corrupt'].includes(op.kind)) problems.push(`${where}: unknown operation`);
        if ('count' in op && (!Number.isInteger(op.count) || op.count <= 0)) problems.push(`${where}: invalid operation count`);
        if ('allowedSides' in op && op.allowedSides && (!op.allowedSides.length || op.allowedSides.some((side) => !['prefix', 'suffix'].includes(side)))) problems.push(`${where}: invalid operation sides`);
        if (op.kind === 'set-rarity' && !['normal', 'magic', 'rare'].includes(op.rarity)) problems.push(`${where}: invalid rarity`);
        if (op.kind === 'add-random-mod' && op.layer && !['explicit', 'desecrated'].includes(op.layer)) problems.push(`${where}: invalid operation layer`);
      }
    }
    for (const cost of action.defaultCost) {
      if (!Number.isFinite(cost.quantity) || cost.quantity <= 0) problems.push(`action ${action.id}: invalid cost quantity`);
      if (!consumableIds.has(cost.consumableId)) {
        problems.push(`action ${action.id}: unknown consumable "${cost.consumableId}"`);
      }
    }
  }

  for (const target of dataset.targets) {
    checkProvenance(`target ${target.id}`, target.provenance);
    if (target.modifierIds.length === 0) problems.push(`target ${target.id}: no modifiers`);
    for (const id of target.modifierIds) {
      if (!modifierIds.has(id)) problems.push(`target ${target.id}: unknown modifier "${id}"`);
    }
  }

  for (const rule of dataset.affixLimits) {
    checkProvenance(`affix limit ${rule.rarity}`, rule.provenance);
    for (const id of rule.itemClassIds ?? []) if (!classIds.has(id)) problems.push(`affix limit ${rule.rarity}: unknown item class "${id}"`);
    if (![rule.maxPrefixes, rule.maxSuffixes].every((n) => Number.isInteger(n) && n >= 0)) problems.push(`affix limit ${rule.rarity}: invalid limits`);
  }
  for (const c of dataset.consumables) {
    checkProvenance(`consumable ${c.id}`, c.provenance);
    if ((c.craftStatus === 'modelled' || c.craftStatus === 'verified') && !dataset.actions.some((a) => rangesOverlap(a.versions, c.versions) && (a.defaultCost.some((cost) => cost.consumableId === c.id && cost.quantity > 0) || (c.actionModifiers && c.modifies?.consumableIds.some((id) => a.defaultCost.some((cost) => cost.consumableId === id)) && modifyAction(a, c.id, c.actionModifiers))))) {
      problems.push(`consumable ${c.id}: modelled status needs an action that spends it`);
    }
    if (!c.modifies) continue;
    checkProvenance(`consumable ${c.id} scope`, c.modifies.provenance);
    if (c.category !== 'omen') problems.push(`consumable ${c.id}: only omens have a scope`);
    for (const id of c.modifies.consumableIds) {
      if (!consumableIds.has(id)) problems.push(`consumable ${c.id}: scope names unknown consumable "${id}"`);
    }
  }

  return problems;
}

/** The same id may appear several times only as non-overlapping revisions. */
function checkRevisions(kind: string, records: readonly Versioned[], problems: string[]): void {
  const byId = new Map<string, Versioned[]>();
  for (const record of records) {
    const list = byId.get(record.id) ?? [];
    for (const other of list) {
      if (rangesOverlap(other.versions, record.versions)) {
        problems.push(`${kind} ${record.id}: revisions with overlapping version ranges`);
      }
    }
    list.push(record);
    byId.set(record.id, list);
  }
}
