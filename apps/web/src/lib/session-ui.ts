/** Glue between the craft session and the UI: seeds, badges and notices. No game rules here. */
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  satisfiesRequirement,
  type ApplyStepResult,
  type CraftSession,
  type ItemComparison,
} from '@poe2-craft/craft-session';
import { formatPercent } from './format';
import { applyRejectionText } from './texts';

export interface ModBadge {
  readonly label: string;
  readonly tone: 'ok' | 'warn' | 'bad' | 'new';
}

export interface WorkspaceNotice {
  readonly tone: 'ok' | 'bad';
  readonly text: string;
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] ?? 0;
}

/** Marks modifiers added by the simulation and those that already satisfy a target requirement. */
export function currentItemBadges(session: CraftSession, comparison: ItemComparison | null): Map<number, ModBadge> {
  const badges = new Map<number, ModBadge>();
  const current = session.current;
  if (!current) return badges;
  const satisfying = new Set(comparison?.rows.filter((r) => satisfiesRequirement(r.status)).map((r) => r.current) ?? []);
  // Steps only ever append, so everything past the item the first step started from was crafted.
  const firstSimulated = session.steps[0]?.before.explicits.length ?? current.explicits.length;
  current.explicits.forEach((mod, index) => {
    const isNew = index >= firstSimulated;
    const isMatch = mod.kind === 'resolved' && satisfying.has(mod);
    if (isNew) badges.set(index, { label: isMatch ? 'новый · цель' : 'новый', tone: 'new' });
    else if (isMatch) badges.set(index, { label: 'цель', tone: 'ok' });
  });
  return badges;
}

export function applyNotice(result: ApplyStepResult, view: CraftDbView): WorkspaceNotice {
  if (result.status === 'applied') {
    const { added, index, actionName } = result.step;
    const tier = view.getModifier(added.modifierId)?.tier ?? added.tier;
    return {
      tone: 'ok',
      text: `Шаг ${index} · ${actionName}: «${added.name}» T${tier} — ${added.text.replace(/\n/g, ' / ')} (шанс ${formatPercent(added.share)})`,
    };
  }
  return {
    tone: 'bad',
    text: applyRejectionText(result.outcome?.status === 'rejected' ? result.outcome.rejection : null),
  };
}
