/**
 * Wording for structured codes coming from the engines. Presentation only: the meaning
 * of each code is defined by the package that emits it.
 */
import type { AffixSide, Confidence, DataSourceKind, Provenance, Rarity, UnresolvedReason } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ParseDiagnostic } from '@poe2-craft/item-parser';
import type { ApplyRejection, TargetModStatus } from '@poe2-craft/craft-session';
import type { ExclusionReason, ExplorerStatus, PoolCaveat, PoolIssue } from '@poe2-craft/probability-engine';

export const SIDE_LABEL: Record<AffixSide, string> = { prefix: 'Префикс', suffix: 'Суффикс' };
export const SIDE_SHORT: Record<AffixSide, string> = { prefix: 'P', suffix: 'S' };

/** Slot kinds come from data; known ones get a Russian label, others show their id. */
export const SLOT_LABEL: Readonly<Record<string, string>> = { 'rune-socket': 'Сокеты рун' };

const SOURCE_KIND_LABEL: Record<DataSourceKind, string> = {
  official: 'официальные данные GGG',
  'game-data': 'файлы игры',
  poe2db: 'PoE2DB',
  'community-testing': 'тесты сообщества',
  observation: 'наблюдение, официальный трейд',
  inferred: 'общеизвестно, не сверено',
  fixture: 'демо-данные',
};

/** One-line provenance: "наблюдение, официальный трейд · verified · 2026-10-02". */
export function sourceTitle(view: CraftDbView, provenance: Provenance): string {
  const source = view.getSource(provenance.sourceId);
  const parts = [source ? SOURCE_KIND_LABEL[source.kind] : provenance.sourceId, provenance.confidence];
  if (provenance.lastVerified) parts.push(provenance.lastVerified);
  return parts.join(' · ');
}

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: 'Обычный',
  magic: 'Магический',
  rare: 'Редкий',
  unique: 'Уникальный',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  official: 'official — заявлено GGG',
  verified: 'verified — проверено по данным игры',
  community: 'community — данные сообщества, не перепроверены',
  experimental: 'experimental — догадка или демо-данные',
};

export const UNRESOLVED_LABEL: Record<UnresolvedReason, string> = {
  'no-matching-definition': 'нет такого мода в CraftDB',
  'value-out-of-range': 'текст знаком, но значение не попадает ни в один тир',
  ambiguous: 'подходит несколько тиров',
};

const modName = (view: CraftDbView, id: string | null) =>
  id === null ? 'нераспознанная строка' : (view.getModifier(id)?.name ?? id);

export function exclusionText(reason: ExclusionReason, view: CraftDbView): string {
  switch (reason.code) {
    case 'not-spawnable-on-base':
      return reason.matchedTag
        ? `не появляется на этой базе (тег «${reason.matchedTag}» даёт вес 0)`
        : 'не появляется на этой базе (ни один тег не подходит)';
    case 'item-level-too-low':
      return `нужен ilvl ${reason.required}, у предмета ${reason.itemLevel}`;
    case 'below-action-min-modifier-level':
      return `уровень мода ${reason.modifierLevel} ниже минимума действия ${reason.minimum}`;
    case 'side-not-allowed-by-action':
      return `действие не добавляет ${reason.side === 'prefix' ? 'префиксы' : 'суффиксы'}`;
    case 'no-free-affix-slot':
      return `нет свободного слота: ${reason.side === 'prefix' ? 'префиксов' : 'суффиксов'} ${reason.used}/${reason.max}`;
    case 'modifier-already-on-item':
      return reason.fractured ? 'этот мод уже есть на предмете (fractured)' : 'этот мод уже есть на предмете';
    case 'group-already-on-item': {
      const group = view.getGroup(reason.groupId)?.name ?? reason.groupId;
      const who = reason.occupant.inferred
        ? `строкой «${reason.occupant.sourceText}»`
        : `модом «${modName(view, reason.occupant.modifierId)}»`;
      return `группа «${group}» уже занята ${who}${reason.occupant.fractured ? ' (fractured)' : ''}`;
    }
  }
}

export const EXCLUSION_TITLE: Record<ExclusionReason['code'], string> = {
  'not-spawnable-on-base': 'Не для этой базы',
  'item-level-too-low': 'Мал item level',
  'below-action-min-modifier-level': 'Ниже минимального уровня мода',
  'side-not-allowed-by-action': 'Сторона запрещена действием',
  'no-free-affix-slot': 'Нет свободного слота',
  'modifier-already-on-item': 'Уже на предмете',
  'group-already-on-item': 'Группа занята',
};

export function issueText(issue: PoolIssue): string {
  switch (issue.code) {
    case 'action-unknown':
      return `Действие ${issue.actionId} отсутствует в этой версии игры.`;
    case 'base-unknown':
      return issue.baseName
        ? `База «${issue.baseName}» не найдена в CraftDB. В v0.1 в базе только fixture-данные для Akoyan Spear.`
        : 'База предмета не распознана.';
    case 'item-level-unknown':
      return 'Не найден Item Level — без него нельзя отсечь тиры.';
    case 'rarity-unknown':
      return 'Не найдена редкость предмета.';
    case 'rarity-not-allowed':
      return `Действие применяется к редкости: ${issue.allowed.map((r) => RARITY_LABEL[r]).join(', ')}; у предмета — ${RARITY_LABEL[issue.rarity]}.`;
    case 'affix-limits-unknown':
      return `Нет данных о лимите аффиксов для редкости «${RARITY_LABEL[issue.rarity]}».`;
  }
}

export function caveatText(caveat: PoolCaveat): string {
  switch (caveat.code) {
    case 'fixture-dataset':
      return 'Все веса, тиры и уровни взяты из демо-набора (fixture). Это не реальные числа PoE 2.';
    case 'unknown-side-lines':
      return `${caveat.count} нераспознанн(ая/ых) строк(а) без известной стороны: счёт свободных слотов может быть неверным.`;
    case 'unresolved-lines-block-groups':
      return `Группы нераспознанных строк считаются занятыми (осторожная оценка): ${caveat.texts.join('; ')}.`;
    case 'modifier-missing-in-version':
      return `Моды предмета отсутствуют в выбранной версии игры: ${caveat.modifierIds.join(', ')}.`;
    case 'unknown-weights-in-pool':
      return `У ${caveat.modifierIds.length} мод(ов) в пуле вес неизвестен — показанный шанс является верхней границей.`;
  }
}

export function diagnosticText(d: ParseDiagnostic): string {
  switch (d.code) {
    case 'text-warning':
      return d.message;
    case 'base-not-in-catalog':
      return `База не найдена в CraftDB: ${d.nameLines.join(' / ')}`;
    case 'unidentified-item':
      return 'Предмет не опознан (Unidentified) — моды не видны.';
    case 'unresolved-modifier':
      return `Не распознано: «${d.text}» — ${UNRESOLVED_LABEL[d.reason]}`;
  }
}

export const EXPLORER_STATUS_LABEL: Record<ExplorerStatus, string> = {
  eligible: 'доступен',
  'already-present': 'уже на предмете',
  blocked: 'заблокирован',
  excluded: 'исключён',
};

export const TARGET_STATUS_LABEL: Record<TargetModStatus, string> = {
  matched: 'есть',
  'better-tier': 'есть, тир лучше',
  'worse-tier': 'тир хуже',
  missing: 'не хватает',
  'not-fractured': 'есть, но не fractured',
  unknown: 'не распознан',
};

export function applyRejectionText(rejection: ApplyRejection | null): string {
  if (!rejection) return 'Нет текущего предмета — импортируйте или создайте исходный.';
  switch (rejection.code) {
    case 'pool-blocked':
      return `Предмет не подходит для этого действия. ${rejection.issues.map(issueText).join(' ')}`;
    case 'no-free-slot':
      return rejection.sides.length === 2
        ? 'Нет свободных слотов: префиксы и суффиксы заняты.'
        : `Нет свободного ${rejection.sides[0] === 'prefix' ? 'префикса' : 'суффикса'}.`;
    case 'no-eligible-modifiers':
      return 'Нет ни одного мода, который действие могло бы добавить: всё подходящее заблокировано.';
    case 'unknown-weights':
      return `У ${rejection.modifierIds.length} мод(ов) в пуле неизвестен вес — честно выбрать результат нельзя.`;
  }
}
