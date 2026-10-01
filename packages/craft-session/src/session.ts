import type {
  AffixSide,
  CraftActionId,
  GameVersion,
  ItemState,
  ModifierId,
} from '@poe2-craft/craft-domain';
import type { CraftDb } from '@poe2-craft/craft-db';
import type { AttemptCost } from '@poe2-craft/economy';
import { applyAction, type ApplyOutcome } from './apply-action';
import { rollRng } from './rng';

/**
 * One crafting session. Three different items, never aliases of one another by accident:
 * - source:  the base the user started from (pasted from the game);
 * - current: the item after every applied step — the thing being crafted;
 * - target:  an example of the desired result (pasted from the game), used for comparison.
 * The session is an immutable value: every operation returns a new session.
 */
export interface CraftSession {
  readonly gameVersion: GameVersion;
  /** Seed of the demo simulation; together with `rollCount` it makes every roll replayable. */
  readonly seed: number;
  /** Number of rolls ever made. Never decreases, so undo + apply does not replay the same roll. */
  readonly rollCount: number;
  readonly source: ItemState | null;
  readonly current: ItemState | null;
  readonly target: ItemState | null;
  readonly steps: readonly CraftStepRecord[];
}

export interface CraftStepRecord {
  /** 1-based position in the history. */
  readonly index: number;
  readonly actionId: CraftActionId;
  readonly actionName: string;
  /** Cost as priced when the step was applied; later price edits do not rewrite history. */
  readonly cost: AttemptCost;
  readonly before: ItemState;
  readonly after: ItemState;
  readonly added: {
    readonly modifierId: ModifierId;
    readonly text: string;
    readonly name: string;
    readonly tier: number;
    readonly side: AffixSide;
    /** Chance this exact modifier had at the moment of the roll. */
    readonly share: number;
  };
}

export interface SessionInit {
  readonly gameVersion: GameVersion;
  readonly seed: number;
  readonly source?: ItemState | null;
  readonly target?: ItemState | null;
}

export function createSession(init: SessionInit): CraftSession {
  const source = init.source ?? null;
  return {
    gameVersion: init.gameVersion,
    seed: init.seed,
    rollCount: 0,
    source,
    current: source,
    target: init.target ?? null,
    steps: [],
  };
}

/** Starts crafting from a (new) source item: current = source, history cleared. Target is kept. */
export function startFromSource(session: CraftSession, source: ItemState | null): CraftSession {
  return { ...session, source, current: source, steps: [] };
}

export function withTarget(session: CraftSession, target: ItemState | null): CraftSession {
  return { ...session, target };
}

export interface ApplyStepInput {
  readonly db: CraftDb;
  readonly actionId: CraftActionId;
  readonly cost: AttemptCost;
}

export type ApplyStepResult =
  | { readonly status: 'applied'; readonly session: CraftSession; readonly step: CraftStepRecord }
  | {
      readonly status: 'rejected';
      /** Unchanged session: a rejected action spends nothing and alters nothing. */
      readonly session: CraftSession;
      readonly outcome: ApplyOutcome | null;
    };

/** Applies one action to the current item (demo simulation) and records it in the history. */
export function applyStep(session: CraftSession, input: ApplyStepInput): ApplyStepResult {
  if (!session.current) return { status: 'rejected', session, outcome: null };

  const outcome = applyAction({
    item: session.current,
    context: { gameVersion: session.gameVersion },
    db: input.db,
    actionId: input.actionId,
    rng: rollRng(session.seed, session.rollCount),
  });
  if (outcome.status === 'rejected') return { status: 'rejected', session, outcome };

  const action = input.db.forVersion(session.gameVersion).getAction(input.actionId);
  const step: CraftStepRecord = {
    index: session.steps.length + 1,
    actionId: input.actionId,
    actionName: action?.name ?? input.actionId,
    cost: input.cost,
    before: outcome.before,
    after: outcome.item,
    added: {
      modifierId: outcome.definition.id,
      text: outcome.added.sourceText,
      name: outcome.definition.name,
      tier: outcome.definition.tier,
      side: outcome.definition.side,
      share: outcome.share,
    },
  };
  return {
    status: 'applied',
    step,
    session: {
      ...session,
      rollCount: session.rollCount + 1,
      current: outcome.item,
      steps: [...session.steps, step],
    },
  };
}

/** Removes the last step and restores the item before it. Its cost leaves "spent" too. */
export function undoLastStep(session: CraftSession): CraftSession {
  const last = session.steps[session.steps.length - 1];
  if (!last) return session;
  return { ...session, current: last.before, steps: session.steps.slice(0, -1) };
}

export interface SessionSpent {
  /** null when nothing was spent yet. */
  readonly unit: string | null;
  readonly total: number;
  readonly stepCount: number;
  /** Some steps had consumables without a price; `total` covers priced lines only. */
  readonly incomplete: boolean;
  /** Steps priced in different units; `total` sums only steps in `unit`. */
  readonly mixedUnits: boolean;
}

/** What was actually spent in this session, as recorded by its steps. */
export function sessionSpent(session: CraftSession): SessionSpent {
  const unit = session.steps[0]?.cost.unit ?? null;
  let total = 0;
  let incomplete = false;
  let mixedUnits = false;
  for (const step of session.steps) {
    if (step.cost.unit !== unit) {
      mixedUnits = true;
      continue;
    }
    total += step.cost.total;
    if (!step.cost.complete) incomplete = true;
  }
  return { unit, total, stepCount: session.steps.length, incomplete, mixedUnits };
}

/** Modifier ids added by the simulation in this session (to mark them on the current item). */
export function simulatedModifierIds(session: CraftSession): ReadonlySet<ModifierId> {
  return new Set(session.steps.map((s) => s.added.modifierId));
}
