/** Glue between the craft session and the UI: seeds, badges and notices. No game rules here. */
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ApplyStepResult, CraftSession, ItemComparison } from '@poe2-craft/craft-session';
import { formatPercent } from './format';
import { TARGET_STATUS_LABEL, applyRejectionText } from './texts';

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

/** Marks modifiers added by the simulation and those that already satisfy the target. */
export function currentItemBadges(session: CraftSession, comparison: ItemComparison | null): Map<number, ModBadge> {
  const badges = new Map<number, ModBadge>();
  const current = session.current;
  if (!current) return badges;
  const matched = new Set(
    comparison?.rows.filter((r) => r.status === 'matched' || r.status === 'better-tier').map((r) => r.current) ?? [],
  );
  // Steps only ever append, so everything past the source's modifiers was added in this session.
  const firstSimulated = session.source?.explicits.length ?? current.explicits.length;
  current.explicits.forEach((mod, index) => {
    const isNew = index >= firstSimulated;
    const isMatch = mod.kind === 'resolved' && matched.has(mod);
    if (isNew) badges.set(index, { label: isMatch ? 'новый · цель' : 'новый', tone: 'new' });
    else if (isMatch) badges.set(index, { label: 'цель', tone: 'ok' });
  });
  return badges;
}

/** Status of each target modifier, shown on the target item card. */
export function targetItemBadges(comparison: ItemComparison | null): Map<number, ModBadge> {
  const badges = new Map<number, ModBadge>();
  comparison?.rows.forEach((row, index) => {
    const tone = row.status === 'matched' || row.status === 'better-tier' ? 'ok' : row.status === 'missing' ? 'bad' : 'warn';
    badges.set(index, { label: TARGET_STATUS_LABEL[row.status], tone });
  });
  return badges;
}

export function applyNotice(result: ApplyStepResult, view: CraftDbView): WorkspaceNotice {
  if (result.status === 'applied') {
    const { added, index } = result.step;
    const tier = view.getModifier(added.modifierId)?.tier ?? added.tier;
    return {
      tone: 'ok',
      text: `Шаг ${index}: выпал «${added.name}» T${tier} — ${added.text.replace(/\n/g, ' / ')} (шанс ${formatPercent(added.share)}).`,
    };
  }
  return {
    tone: 'bad',
    text: applyRejectionText(result.outcome?.status === 'rejected' ? result.outcome.rejection : null),
  };
}
