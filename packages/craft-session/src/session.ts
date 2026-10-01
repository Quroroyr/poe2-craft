import type {
  AffixSide,
  CraftActionId,
  GameVersion,
  ItemState,
  ModifierId,
  TargetSpec,
} from '@poe2-craft/craft-domain';
import type { CraftDb } from '@poe2-craft/craft-db';
import type { AttemptCost } from '@poe2-craft/economy';
import { applyAction, type ApplyOutcome } from './apply-action';
import { rollRng } from './rng';

/**
 * One crafting session. Three different things, never aliases of one another by accident:
 * - source:  the base the user starts from (imported from the game, editable by hand);
 * - current: the item after every applied step — the only thing crafting actions change;
 * - target:  the desired result as requirements (imported and/or built by hand).
 * The session is an immutable value: every operation returns a new session.
 */
export interface CraftSession {
  readonly gameVersion: GameVersion;
  /** Seed of the demo simulation; together with `rollCount` it makes every roll replayable. */
  readonly rollCount: number;
  readonly seed: number;
  readonly source: ItemState | null;
  readonly current: ItemState | null;
  readonly target: TargetSpec | null;
  /** Applied steps, oldest first. `current` is the `after` of the last one (or the source). */
  readonly steps: readonly CraftStepRecord[];
  /** Undone steps, most recently undone last; `redo` re-applies them exactly as they were. */
  readonly redoStack: readonly CraftStepRecord[];
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
  readonly target?: TargetSpec | null;
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
    redoStack: [],
  };
}

/**
 * Replaces the source (import or manual edit). Before the first step the current item follows
 * the source; once crafting started, the current item is left alone until `resetToSource`.
 * Never counted as spending.
 */
export function setSource(session: CraftSession, source: ItemState | null): CraftSession {
  const untouched = session.steps.length === 0;
  return { ...session, source, current: untouched ? source : session.current, redoStack: untouched ? [] : session.redoStack };
}

/** The source changed after crafting started, so current no longer descends from it. */
export function isSourceOutOfSync(session: CraftSession): boolean {
  const first = session.steps[0];
  return first !== undefined && first.before !== session.source;
}

/** Reset craft: current = source, history and spending cleared. Source and target untouched. */
export function resetToSource(session: CraftSession): CraftSession {
  return { ...session, current: session.source, steps: [], redoStack: [] };
}

/** Starts over from a new source item: the same as `setSource` followed by `resetToSource`. */
export function startFromSource(session: CraftSession, source: ItemState | null): CraftSession {
  return resetToSource({ ...session, source });
}

export function withTarget(session: CraftSession, target: TargetSpec | null): CraftSession {
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
      // A new roll makes the undone branch unreachable, as in any editor.
      redoStack: [],
    },
  };
}

/** Undoes the last step: current goes back to the item before it, its cost leaves "spent". */
export function undoLastStep(session: CraftSession): CraftSession {
  const last = session.steps[session.steps.length - 1];
  if (!last) return session;
  return {
    ...session,
    current: last.before,
    steps: session.steps.slice(0, -1),
    redoStack: [...session.redoStack, last],
  };
}

/** Re-applies the most recently undone step exactly as it happened (no new roll). */
export function redoStep(session: CraftSession): CraftSession {
  const next = session.redoStack[session.redoStack.length - 1];
  if (!next) return session;
  return {
    ...session,
    current: next.after,
    steps: [...session.steps, next],
    redoStack: session.redoStack.slice(0, -1),
  };
}

/** Rolls back to just after step `index` (0 = before the first step), keeping later steps redoable. */
export function undoToStep(session: CraftSession, index: number): CraftSession {
  let result = session;
  while (result.steps.length > Math.max(0, index)) result = undoLastStep(result);
  return result;
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

/** What was actually spent on the current item, as recorded by its (not undone) steps. */
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
