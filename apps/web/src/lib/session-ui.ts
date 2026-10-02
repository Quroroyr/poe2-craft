/** Glue between the craft session and the UI: seeds, badges and notices. No game rules here. */
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  currentModifierMarks,
  satisfiesRequirement,
  type ApplyStepResult,
  type CraftSession,
  type ItemComparison,
} from '@poe2-craft/craft-session';
import type { Translator } from '@/i18n/core';
import { formatPercent } from './format';
import { applyRejectionText } from './texts';

export interface ModBadge {
  readonly label: string;
  readonly tone: 'ok' | 'warn' | 'bad' | 'new' | 'manual';
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

/**
 * Marks modifiers added by the simulation, those changed by a manual edit, and those that already
 * satisfy a target requirement. One badge per modifier: a manual change is the most important to see.
 */
export function currentItemBadges(t: Translator, session: CraftSession, comparison: ItemComparison | null): Map<number, ModBadge> {
  const badges = new Map<number, ModBadge>();
  const current = session.current;
  if (!current) return badges;
  const satisfying = new Set(comparison?.rows.filter((r) => satisfiesRequirement(r.status)).map((r) => r.current) ?? []);
  const marks = currentModifierMarks(session);
  current.explicits.forEach((mod, index) => {
    const mark = marks[index];
    const isMatch = mod.kind === 'resolved' && satisfying.has(mod);
    if (mark?.edited) badges.set(index, { label: t(isMatch ? 'badge.manualTarget' : 'badge.manual'), tone: 'manual' });
    else if (mark?.crafted) badges.set(index, { label: t(isMatch ? 'badge.newTarget' : 'badge.new'), tone: 'new' });
    else if (isMatch) badges.set(index, { label: t('badge.target'), tone: 'ok' });
  });
  return badges;
}

export function applyNotice(t: Translator, result: ApplyStepResult, view: CraftDbView): WorkspaceNotice {
  if (result.status === 'applied') {
    const { added, index, actionName } = result.step;
    const tier = view.tierOf(added.modifierId, result.step.after.baseId) || added.tier;
    return {
      tone: 'ok',
      text: t('notice.applied', {
        index,
        action: actionName,
        name: added.name,
        tier,
        text: added.text.replace(/\n/g, ' / '),
        chance: formatPercent(added.share),
      }),
    };
  }
  return {
    tone: 'bad',
    text: applyRejectionText(t, result.outcome?.status === 'rejected' ? result.outcome.rejection : null),
  };
}
