/**
 * Wording for structured codes coming from the engines, in the active interface language.
 * Presentation only: the meaning of each code is defined by the package that emits it. Every
 * function takes the translator; no text is hard-coded here.
 */
import type { AffixSide, ConsumableCategory, Confidence, Provenance, Rarity, UnresolvedReason } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ParseDiagnostic } from '@poe2-craft/item-parser';
import type {
  ApplyRejection,
  ManualEditOperation,
  ManualEditRejection,
  ManualEditStepRecord,
  TargetRowState,
} from '@poe2-craft/craft-session';
import type { ExclusionReason, ExplorerStatus, PoolCaveat, PoolIssue } from '@poe2-craft/probability-engine';
import type { MessageKey, Translator } from '@/i18n/core';

/** P / S marks are the same in every language. */
export const SIDE_SHORT: Record<AffixSide, string> = { prefix: 'P', suffix: 'S' };

export const sideLabel = (t: Translator, side: AffixSide) => t(side === 'prefix' ? 'side.prefix' : 'side.suffix');
export const sidesLabel = (t: Translator, side: AffixSide) => t(side === 'prefix' ? 'side.prefixes' : 'side.suffixes');
export const rarityLabel = (t: Translator, rarity: Rarity) => t(`rarity.${rarity}`);
export const targetStateLabel = (t: Translator, state: TargetRowState) => t(`targetState.${state}`);
export const toolCategoryLabel = (t: Translator, category: ConsumableCategory) => t(`toolCategory.${category}`);
export const explorerStatusLabel = (t: Translator, status: ExplorerStatus) => t(`explorerStatus.${status}`);
export const confidenceLabel = (t: Translator, confidence: Confidence) => t(`confidence.${confidence}`);
export const unresolvedLabel = (t: Translator, reason: UnresolvedReason) => t(`unresolved.${reason}`);
export const manualOperationLabel = (t: Translator, op: ManualEditOperation) => t(`manualOp.${op}`);
export const exclusionTitle = (t: Translator, code: ExclusionReason['code']) => t(`exclusionTitle.${code}`);

/** Data-driven names (item categories, slot kinds, base properties): known ones translated, others shown as given. */
function known(t: Translator, key: string, fallback: string): string {
  const text = t(key as MessageKey);
  return text === key ? fallback : text;
}
export const itemCategoryLabel = (t: Translator, category: string) => known(t, `itemCategory.${category}`, category);
export const slotLabel = (t: Translator, kind: string, fallback = kind) => known(t, `slot.${kind}`, fallback);
export const propertyLabel = (t: Translator, name: string) => known(t, `property.${name}`, name);

/** One-line provenance: "observation, official trade · verified · 2026-10-02". */
export function sourceTitle(t: Translator, view: CraftDbView, provenance: Provenance): string {
  const source = view.getSource(provenance.sourceId);
  const parts = [source ? t(`sourceKind.${source.kind}`) : provenance.sourceId, provenance.confidence];
  if (provenance.lastVerified) parts.push(provenance.lastVerified);
  return parts.join(' · ');
}

export function exclusionText(t: Translator, reason: ExclusionReason, view: CraftDbView): string {
  switch (reason.code) {
    case 'not-spawnable-on-base':
      return reason.matchedTag ? t('exclusion.notOnBaseTag', { tag: reason.matchedTag }) : t('exclusion.notOnBase');
    case 'item-level-too-low':
      return t('exclusion.itemLevel', { required: reason.required, itemLevel: reason.itemLevel });
    case 'below-action-min-modifier-level':
      return t('exclusion.minModLevel', { level: reason.modifierLevel, minimum: reason.minimum });
    case 'side-not-allowed-by-action':
      return t(reason.side === 'prefix' ? 'exclusion.sidePrefix' : 'exclusion.sideSuffix');
    case 'no-free-affix-slot':
      return t(reason.side === 'prefix' ? 'exclusion.noSlotPrefix' : 'exclusion.noSlotSuffix', { used: reason.used, max: reason.max });
    case 'modifier-already-on-item':
      return t(reason.fractured ? 'exclusion.onItemFractured' : 'exclusion.onItem');
    case 'group-already-on-item': {
      const group = view.getGroup(reason.groupId)?.name ?? reason.groupId;
      const fractured = reason.occupant.fractured ? t('exclusion.fracturedMark') : '';
      if (reason.occupant.inferred) return t('exclusion.groupByLine', { group, text: reason.occupant.sourceText, fractured });
      const id = reason.occupant.modifierId;
      const name = id === null ? t('exclusion.unrecognised') : (view.getModifier(id)?.name ?? id);
      return t('exclusion.groupByMod', { group, name, fractured });
    }
  }
}

export const exclusionsText = (t: Translator, reasons: readonly ExclusionReason[], view: CraftDbView) =>
  reasons.map((r) => exclusionText(t, r, view)).join('; ');

export function issueText(t: Translator, issue: PoolIssue): string {
  switch (issue.code) {
    case 'action-unknown':
      return t('issue.actionUnknown', { id: issue.actionId });
    case 'base-unknown':
      return issue.baseName ? t('issue.baseUnknownNamed', { name: issue.baseName }) : t('issue.baseUnknown');
    case 'item-level-unknown':
      return t('issue.itemLevelUnknown');
    case 'rarity-unknown':
      return t('issue.rarityUnknown');
    case 'rarity-not-allowed':
      return t('issue.rarityNotAllowed', {
        allowed: issue.allowed.map((r) => rarityLabel(t, r)).join(', '),
        rarity: rarityLabel(t, issue.rarity),
      });
    case 'affix-limits-unknown':
      return t('issue.affixLimitsUnknown', { rarity: rarityLabel(t, issue.rarity) });
  }
}

export function caveatText(t: Translator, caveat: PoolCaveat): string {
  switch (caveat.code) {
    case 'fixture-dataset':
      return t('caveat.fixture');
    case 'unknown-side-lines':
      return t('caveat.unknownSide', { count: caveat.count });
    case 'unresolved-lines-block-groups':
      return t('caveat.unresolvedGroups', { texts: caveat.texts.join('; ') });
    case 'modifier-missing-in-version':
      return t('caveat.missingInVersion', { ids: caveat.modifierIds.join(', ') });
    case 'unknown-weights-in-pool':
      return t('caveat.unknownWeights', { count: caveat.modifierIds.length });
  }
}

/** Import diagnostics; `text-warning` messages come from the parser as they are. */
export function diagnosticText(t: Translator, d: ParseDiagnostic): string {
  switch (d.code) {
    case 'text-warning':
      return d.message;
    case 'base-not-in-catalog':
      return t('diag.baseNotInCatalog', { names: d.nameLines.join(' / ') });
    case 'unidentified-item':
      return t('diag.unidentified');
    case 'unresolved-modifier':
      return t('diag.unresolved', { text: d.text, reason: unresolvedLabel(t, d.reason) });
  }
}

export function applyRejectionText(t: Translator, rejection: ApplyRejection | null): string {
  if (!rejection) return t('applyRejection.noItem');
  switch (rejection.code) {
    case 'pool-blocked':
      return t('applyRejection.poolBlocked', { issues: rejection.issues.map((i) => issueText(t, i)).join(' ') });
    case 'no-free-slot':
      return rejection.sides.length === 2
        ? t('applyRejection.noSlots')
        : t(rejection.sides[0] === 'prefix' ? 'applyRejection.noPrefix' : 'applyRejection.noSuffix');
    case 'no-eligible-modifiers':
      return t('applyRejection.noEligible');
    case 'unknown-weights':
      return t('applyRejection.unknownWeights', { count: rejection.modifierIds.length });
  }
}

/** One history line for a manual edit, e.g. "T3 → T2 · 12% increased Attack Speed". Game text stays as is. */
export function manualEditText(step: ManualEditStepRecord): string {
  const tier = (n: number | null) => (n === null ? '?' : `T${n}`);
  const text = (s: string) => s.replace(/\s*\(fractured\)$/i, '').replace(/\n/g, ' / ');
  switch (step.operation) {
    case 'retier':
      return `${tier(step.from.tier)} → ${tier(step.to?.tier ?? null)} · ${text(step.to?.text ?? step.from.text)}`;
    case 'replace':
      return `${text(step.from.text)} → ${text(step.to?.text ?? '')}`;
    case 'remove':
      return `− ${text(step.from.text)}`;
    case 'fracture':
    case 'unfracture':
      return text(step.from.text);
  }
}

export function manualEditRejectionText(
  t: Translator,
  reason: ManualEditRejection,
  details: readonly ExclusionReason[],
  view: CraftDbView,
): string {
  switch (reason) {
    case 'no-item':
    case 'no-modifier':
      return t('manualReject.gone');
    case 'unresolved-modifier':
      return t('manualReject.unresolved');
    case 'unknown-modifier':
      return t('manualReject.unknown');
    case 'not-same-family':
      return t('manualReject.family');
    case 'no-change':
      return t('manualReject.noChange');
    case 'not-allowed':
      return details.length > 0
        ? t('manualReject.notAllowed', { reasons: exclusionsText(t, details, view) })
        : t('manualReject.duplicate');
  }
}
