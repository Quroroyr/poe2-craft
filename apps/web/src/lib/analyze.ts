/**
 * Composition root of the web app: wires parser, CraftDB, probability engine and craft session.
 * Contains no game rules — only the order in which the packages are called.
 */
import { akoyanSpearFixture, createCraftDb, type CraftDbView } from '@poe2-craft/craft-db';
import type { CraftActionId, CraftTarget, GameVersion, ItemState } from '@poe2-craft/craft-domain';
import { parseItem, type ItemParseResult } from '@poe2-craft/item-parser';
import {
  buildEligiblePool,
  calculateTargetProbability,
  explainCalculation,
  explorePool,
  type EligiblePool,
  type ExplanationStep,
  type PoolExplorer,
  type ProbabilityResult,
} from '@poe2-craft/probability-engine';
import {
  compareToTarget,
  outstandingTargetModifiers,
  startFromSource,
  targetFromModifier,
  withTarget,
  type CraftSession,
  type ItemComparison,
} from '@poe2-craft/craft-session';

export const craftDb = createCraftDb(akoyanSpearFixture);
export const DEFAULT_GAME_VERSION: GameVersion =
  craftDb.supportedVersions[craftDb.supportedVersions.length - 1] ?? '0.5.0';

export interface StageTargetOption {
  readonly key: string;
  readonly origin: 'target-item' | 'catalog';
  readonly target: CraftTarget;
}

export interface WorkspaceInput {
  readonly sourceText: string;
  readonly targetText: string;
  readonly session: CraftSession;
  readonly actionId: CraftActionId;
  readonly stageTargetKey: string | null;
}

export interface WorkspaceAnalysis {
  readonly view: CraftDbView;
  readonly source: ItemParseResult | null;
  readonly target: ItemParseResult | null;
  /** The session as the UI should see it: before the first step, current follows the source text. */
  readonly session: CraftSession;
  readonly current: ItemState | null;
  readonly pool: EligiblePool | null;
  readonly explorer: PoolExplorer | null;
  readonly comparison: ItemComparison | null;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTarget: StageTargetOption | null;
  readonly probability: ProbabilityResult | null;
  readonly explanation: readonly ExplanationStep[];
}

const parseOrNull = (text: string, view: CraftDbView) => (text.trim() ? parseItem(text, view) : null);

export function analyzeWorkspace(input: WorkspaceInput): WorkspaceAnalysis {
  const view = craftDb.forVersion(input.session.gameVersion);
  const source = parseOrNull(input.sourceText, view);
  const target = parseOrNull(input.targetText, view);

  const synced = input.session.steps.length === 0 ? startFromSource(input.session, source?.state ?? null) : input.session;
  const session = withTarget(synced, target?.state ?? null);
  const current = session.current;

  const pool = current
    ? buildEligiblePool({
        item: current,
        context: { gameVersion: session.gameVersion },
        db: craftDb,
        actionId: input.actionId,
      })
    : null;
  const explorer = pool?.status === 'ready' ? explorePool(pool, view) : null;
  const comparison = current && session.target ? compareToTarget(current, session.target, view) : null;

  const stageTargets = stageTargetOptions(view, comparison);
  const stageTarget =
    stageTargets.find((o) => o.key === input.stageTargetKey) ?? stageTargets[0] ?? null;
  const probability = pool && stageTarget ? calculateTargetProbability(pool, stageTarget.target) : null;
  const explanation =
    pool && stageTarget && probability ? explainCalculation(pool, stageTarget.target, probability) : [];

  return {
    view,
    source,
    target,
    session,
    current,
    pool,
    explorer,
    comparison,
    stageTargets,
    stageTarget,
    probability,
    explanation,
  };
}

/** Outstanding modifiers of the target item first, then the catalog targets of the dataset. */
function stageTargetOptions(view: CraftDbView, comparison: ItemComparison | null): StageTargetOption[] {
  const fromItem = comparison
    ? outstandingTargetModifiers(comparison).flatMap((definition): StageTargetOption[] => {
        const target = targetFromModifier(view, definition.id);
        return target ? [{ key: `item:${definition.id}`, origin: 'target-item', target }] : [];
      })
    : [];
  const catalog = view
    .listTargets()
    .map((target): StageTargetOption => ({ key: `catalog:${target.id}`, origin: 'catalog', target }));
  return [...fromItem, ...catalog];
}
