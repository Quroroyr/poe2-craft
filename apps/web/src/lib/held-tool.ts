/**
 * What the pointer "holds" over the current item: the selected currency (and omen) icons and
 * whether a click would apply. Derived from the resolved tool and the shared applicability check;
 * the overlay only draws this, it never applies anything itself.
 */
import type { ResolvedTool } from '@poe2-craft/craft-session';
import { consumableIconUrl } from './icons';

export interface HeldToolIcon {
  readonly src: string | null;
  readonly name: string;
  readonly role: 'currency' | 'omen' | 'essence';
}

export interface HeldTool {
  readonly icons: readonly HeldToolIcon[];
  /** ready: a click applies; blocked: a click is refused and spends nothing. */
  readonly state: 'ready' | 'blocked';
  readonly reason: string | null;
}

export function heldTool(resolved: ResolvedTool, blockedReason: string | null): HeldTool | null {
  if (resolved.status === 'none') return null;
  const icons = resolved.consumables.map((c) => ({ src: consumableIconUrl(c), name: c.name, role: c.category }));
  if (resolved.status === 'unsupported') {
    return { icons, state: 'blocked', reason: 'эта комбинация не смоделирована' };
  }
  return { icons, state: blockedReason ? 'blocked' : 'ready', reason: blockedReason };
}
