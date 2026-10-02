/**
 * What the pointer "holds" over the current item: the primary consumable's icon, small omen badges,
 * and whether a click would apply. Derived from the resolved tool and the shared applicability check;
 * the overlay only draws this, it never applies anything itself.
 */
import type { ConsumableCategory } from '@poe2-craft/craft-domain';
import type { ResolvedTool } from '@poe2-craft/craft-session';
import type { Translator } from '@/i18n/core';
import { consumableIconUrl } from './icons';

export interface HeldToolIcon {
  readonly src: string | null;
  readonly name: string;
  readonly role: ConsumableCategory;
}

export interface HeldTool {
  /** Primary consumable first, then omens (drawn as badges). */
  readonly icons: readonly HeldToolIcon[];
  /** ready: a click applies; blocked: a click is refused and spends nothing. */
  readonly state: 'ready' | 'blocked';
  readonly reason: string | null;
}

export function heldTool(t: Translator, resolved: ResolvedTool, blockedReason: string | null): HeldTool | null {
  // Nothing in hand: omens alone are shown in the active craft panel, not on the pointer.
  if (resolved.status === 'none') return null;
  const icons = resolved.consumables.map((c) => ({ src: consumableIconUrl(c), name: c.name, role: c.category }));
  if (resolved.status === 'incompatible') {
    return { icons, state: 'blocked', reason: t('held.incompatible') };
  }
  if (resolved.status === 'unsupported') {
    return { icons, state: 'blocked', reason: t(icons.length > 1 ? 'held.unsupportedCombo' : 'held.unsupported') };
  }
  return { icons, state: blockedReason ? 'blocked' : 'ready', reason: blockedReason };
}
