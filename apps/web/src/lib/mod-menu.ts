/**
 * What the context menu of a modifier offers, as plain data: labels, availability and the intent
 * each item carries. The rules come from craft-session (tier options, pick options, manual edits);
 * this file only arranges them per item card. The page dispatches the intents.
 */
import {
  modifierText,
  removeRequirement,
  setRequirementFractured,
  setRequirementTier,
  type ExplicitModifier,
  type ItemState,
  type ModifierDefinition,
  type ModifierId,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import type { CraftDb, CraftDbView } from '@poe2-craft/craft-db';
import {
  addModifierToTarget,
  betterTierOption,
  currentTierOptions,
  familyTiers,
  removeSourceModifier,
  replaceSourceModifier,
  setSourceModifierFractured,
  sourceTierOptions,
  targetForSource,
  type CraftSession,
  type ManualEdit,
  type TierOption,
} from '@poe2-craft/craft-session';
import type { IconName } from '@/components/Icon';
import type { ExplorerMode } from './analyze';
import { exclusionText } from './texts';

/** Which modifier the menu is about. */
export type ModMenuTarget =
  | { readonly scope: 'current'; readonly index: number }
  | { readonly scope: 'source'; readonly index: number }
  | { readonly scope: 'target'; readonly requirementId: string };

/** What choosing an item does. Item states are prepared by craft-session functions, never here. */
export type MenuIntent =
  /** Sandbox edit of the current item, recorded as a ManualEditStep (ADR 009). */
  | { readonly kind: 'manual-edit'; readonly edit: ManualEdit }
  /** Source setup: not a step, never spending. */
  | { readonly kind: 'source'; readonly source: ItemState }
  | { readonly kind: 'target'; readonly target: TargetSpec }
  | { readonly kind: 'explore'; readonly mode: ExplorerMode }
  /** Navigation only: open the pool on this modifier's tab, family and tier. */
  | { readonly kind: 'show-in-pool'; readonly modifierId: ModifierId }
  | { readonly kind: 'add-to-target'; readonly modifierId: ModifierId; readonly fractured: boolean };

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  /** Short text on the right, e.g. the tier an upgrade leads to. */
  readonly hint?: string;
  readonly disabled?: boolean;
  /** Why the item is disabled; shown under the label. */
  readonly reason?: string;
  /** Radio state inside a submenu (the current tier). */
  readonly checked?: boolean;
  readonly separatorBefore?: boolean;
  readonly intent?: MenuIntent;
  readonly submenu?: { readonly title: string; readonly items: readonly MenuItem[] };
}

export interface MenuModel {
  readonly title: string;
  readonly subtitle?: string;
  /** A line that says what kind of change the items make (e.g. a manual edit is not crafting). */
  readonly note?: string;
  readonly items: readonly MenuItem[];
}

export interface MenuContext {
  readonly session: CraftSession;
  readonly db: CraftDb;
  readonly view: CraftDbView;
  /** The inspect pool exists (a ready tool is held), so "show in pool" has somewhere to go. */
  readonly poolAvailable: boolean;
}

const NO_POOL = 'Возьмите валюту: пул строится для неё';

export function buildModMenu(target: ModMenuTarget, ctx: MenuContext): MenuModel | null {
  switch (target.scope) {
    case 'current':
      return currentMenu(target.index, ctx);
    case 'source':
      return sourceMenu(target.index, ctx);
    case 'target':
      return targetMenu(target.requirementId, ctx);
  }
}

function currentMenu(index: number, ctx: MenuContext): MenuModel | null {
  const { session, view } = ctx;
  const current = session.current;
  const mod = current?.explicits[index];
  if (!current || !mod) return null;
  const note = 'Ручная правка — не крафт: валюта не тратится, шаг пишется в историю';
  const fractureItem: MenuItem = {
    id: 'fracture',
    label: mod.fractured ? 'Снять Fractured' : 'Сделать Fractured',
    icon: 'crack',
    separatorBefore: true,
    intent: { kind: 'manual-edit', edit: { operation: mod.fractured ? 'unfracture' : 'fracture', index } },
  };
  const removeItem: MenuItem = {
    id: 'remove',
    label: 'Удалить мод',
    icon: 'close',
    intent: { kind: 'manual-edit', edit: { operation: 'remove', index } },
  };
  const definition = definitionOf(mod, view);
  if (!definition) {
    return {
      title: clean(mod.sourceText),
      subtitle: 'мод не распознан — тир, пул и цель недоступны',
      note,
      items: [{ ...fractureItem, separatorBefore: false }, removeItem],
    };
  }

  const tiers = currentTierOptions(ctx.db, session.gameVersion, current, index);
  const better = betterTierOption(tiers, definition.id);
  const upgrade: MenuItem = better
    ? {
        id: 'upgrade',
        label: 'Повысить на тир',
        icon: 'up',
        hint: `→ T${better.definition.tier}`,
        disabled: !better.allowed,
        reason: better.allowed ? undefined : reasonText(better, view),
        intent: { kind: 'manual-edit', edit: { operation: 'retier', index, modifierId: better.definition.id } },
      }
    : { id: 'upgrade', label: 'Повысить на тир', icon: 'up', disabled: true, reason: 'это лучший тир семейства' };

  return {
    title: familyName(definition, view),
    subtitle: `T${definition.tier} · ${clean(mod.sourceText)}`,
    note,
    items: [
      upgrade,
      {
        id: 'tier',
        label: 'Изменить тир…',
        icon: 'list',
        submenu: {
          title: 'Тир',
          items: tierItems(tiers, definition.id, (tier) => ({
            kind: 'manual-edit',
            edit: { operation: 'retier', index, modifierId: tier.id },
          }), view),
        },
      },
      {
        id: 'replace',
        label: 'Заменить из пула…',
        icon: 'swap',
        intent: { kind: 'explore', mode: { kind: 'edit-current', side: definition.side, replaceIndex: index } },
      },
      fractureItem,
      removeItem,
      { ...showInPool(definition, ctx), separatorBefore: true },
      ...addToTargetItems(mod, definition, ctx),
    ],
  };
}

function sourceMenu(index: number, ctx: MenuContext): MenuModel | null {
  const { session, view } = ctx;
  const source = session.source;
  const mod = source?.explicits[index];
  if (!source || !mod) return null;
  const definition = definitionOf(mod, view);
  if (!definition) return null;
  const tiers = sourceTierOptions(ctx.db, session.gameVersion, source, index);
  return {
    title: familyName(definition, view),
    subtitle: `T${definition.tier} · ${clean(mod.sourceText)}`,
    note: 'Настройка исходного — не крафт и не шаг истории',
    items: [
      {
        id: 'tier',
        label: 'Изменить тир…',
        icon: 'list',
        submenu: {
          title: 'Тир',
          items: tierItems(tiers, definition.id, (tier) => ({
            kind: 'source',
            source: replaceSourceModifier(source, index, tier),
          }), view),
        },
      },
      {
        id: 'replace',
        label: 'Заменить из пула…',
        icon: 'swap',
        intent: { kind: 'explore', mode: { kind: 'edit-source', side: definition.side, replaceIndex: index } },
      },
      {
        id: 'fracture',
        label: mod.fractured ? 'Снять Fractured' : 'Сделать Fractured',
        icon: 'crack',
        separatorBefore: true,
        intent: { kind: 'source', source: setSourceModifierFractured(source, index, !mod.fractured) },
      },
      { id: 'remove', label: 'Удалить мод', icon: 'close', intent: { kind: 'source', source: removeSourceModifier(source, index) } },
      { ...showInPool(definition, ctx), separatorBefore: true },
    ],
  };
}

function targetMenu(requirementId: string, ctx: MenuContext): MenuModel | null {
  const { session, view } = ctx;
  const target = session.target;
  const requirement = target?.requirements.find((r) => r.id === requirementId);
  if (!target || !requirement) return null;
  const definition = view.getModifier(requirement.modifierId);
  const remove: MenuItem = {
    id: 'remove',
    label: 'Удалить требование',
    icon: 'close',
    separatorBefore: true,
    intent: { kind: 'target', target: removeRequirement(target, requirement.id) },
  };
  const fractured: MenuItem = {
    id: 'fracture',
    label: requirement.fractured ? 'Не требовать Fractured' : 'Требовать Fractured',
    icon: 'crack',
    intent: { kind: 'target', target: setRequirementFractured(target, requirement.id, !requirement.fractured) },
  };
  if (!definition) {
    return { title: requirement.modifierId, subtitle: 'мода нет в этой версии игры', items: [fractured, remove] };
  }
  return {
    title: familyName(definition, view),
    subtitle: `${tierLabel(definition.tier)} · ${modifierText(definition)}`,
    note: 'Требование цели: минимальный приемлемый тир',
    items: [
      {
        id: 'tier',
        label: 'Изменить минимальный тир…',
        icon: 'list',
        submenu: {
          title: 'Минимальный тир',
          items: familyTiers(view, definition).map(
            (tier): MenuItem => ({
              id: `tier-${tier.id}`,
              label: tierLabel(tier.tier),
              hint: modifierText(tier),
              checked: tier.id === definition.id,
              intent: tier.id === definition.id ? undefined : { kind: 'target', target: setRequirementTier(target, requirement.id, tier.id) },
            }),
          ),
        },
      },
      fractured,
      { ...showInPool(definition, ctx), separatorBefore: true },
      remove,
    ],
  };
}

function tierItems(
  tiers: readonly TierOption[],
  currentId: ModifierId,
  intent: (tier: ModifierDefinition) => MenuIntent,
  view: CraftDbView,
): MenuItem[] {
  return tiers.map((option) => {
    const d = option.definition;
    const isCurrent = d.id === currentId;
    return {
      id: `tier-${d.id}`,
      label: `T${d.tier}`,
      hint: modifierText(d),
      checked: isCurrent,
      disabled: !isCurrent && !option.allowed,
      reason: !isCurrent && !option.allowed ? reasonText(option, view) : undefined,
      intent: isCurrent || !option.allowed ? undefined : intent(d),
    };
  });
}

function showInPool(definition: ModifierDefinition, ctx: MenuContext): MenuItem {
  return {
    id: 'show-in-pool',
    label: 'Показать в пуле модов',
    icon: 'search',
    disabled: !ctx.poolAvailable,
    reason: ctx.poolAvailable ? undefined : NO_POOL,
    intent: { kind: 'show-in-pool', modifierId: definition.id },
  };
}

function addToTargetItems(mod: ExplicitModifier, definition: ModifierDefinition, ctx: MenuContext): MenuItem[] {
  const { session } = ctx;
  const target = session.target ?? targetForSource(session.source ?? session.current);
  const fallback = session.source ?? session.current;
  const item = (fractured: boolean): MenuItem => {
    const dry = addModifierToTarget(ctx.db, session.gameVersion, target, fallback, definition.id, fractured);
    const base = fractured ? 'Добавить в цель как fractured' : 'Добавить в цель';
    const label = dry.status === 'retiered' ? `${base} (мин. T${definition.tier})` : base;
    const disabled = dry.status === 'already' || dry.status === 'not-allowed';
    const reason =
      dry.status === 'already'
        ? 'уже в цели'
        : dry.status === 'not-allowed'
          ? dry.reasons.map((r) => exclusionText(r, ctx.view)).join('; ') || 'цель не может это принять'
          : undefined;
    return {
      id: fractured ? 'add-to-target-fractured' : 'add-to-target',
      label,
      icon: 'target',
      disabled,
      reason,
      intent: { kind: 'add-to-target', modifierId: definition.id, fractured },
    };
  };
  return mod.fractured ? [item(false), item(true)] : [item(false)];
}

function definitionOf(mod: ExplicitModifier, view: CraftDbView): ModifierDefinition | undefined {
  return mod.kind === 'resolved' ? view.getModifier(mod.modifierId) : undefined;
}

function familyName(definition: ModifierDefinition, view: CraftDbView): string {
  return definition.groupIds.map((g) => view.getGroup(g)?.name ?? g).join(' + ');
}

function reasonText(option: TierOption, view: CraftDbView): string {
  return option.reasons.map((r) => exclusionText(r, view)).join('; ') || 'недоступно';
}

const tierLabel = (tier: number) => (tier === 1 ? 'T1' : `T${tier}+`);
const clean = (text: string) => text.replace(/\s*\(fractured\)$/i, '').replace(/\n/g, ' / ');
