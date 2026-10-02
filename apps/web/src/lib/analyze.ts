/**
 * Composition root of the web app: wires parser, CraftDB, probability engine and craft session.
 * Contains no game rules — only the order in which the packages are called.
 */
import { akoyanSpearFixture, createCraftDb, type CraftDbView } from '@poe2-craft/craft-db';
import { targetSpecFromItem, type CraftTarget, type GameVersion, type ItemState, type TargetSpec } from '@poe2-craft/craft-domain';
import { parseItem, type ItemParseResult } from '@poe2-craft/item-parser';
import {
  calculateTargetProbability,
  explainCalculation,
  explorePool,
  type EligiblePool,
  type ExclusionReason,
  type ExplanationStep,
  type PoolExplorer,
  type ProbabilityResult,
} from '@poe2-craft/probability-engine';
import {
  checkApplicable,
  compareToTarget,
  itemSetupFields,
  outstandingTargetModifiers,
  poolForMode,
  resolveTool,
  sourceModifierIssues,
  sourceTierOptions,
  targetBaseCheck,
  targetFromModifier,
  type ApplyRejection,
  type CraftSession,
  type ItemComparison,
  type ItemSetupFields,
  type PoolMode,
  type ResolvedTool,
  type TargetBaseCheck,
  type TierOption,
  type ToolSelection,
} from '@poe2-craft/craft-session';

export const craftDb = createCraftDb(akoyanSpearFixture);
export const DEFAULT_GAME_VERSION: GameVersion =
  craftDb.supportedVersions[craftDb.supportedVersions.length - 1] ?? '0.5.0';

export function importItem(text: string, gameVersion: GameVersion): ItemParseResult | null {
  return text.trim() ? parseItem(text, craftDb.forVersion(gameVersion)) : null;
}

export function importSource(text: string, gameVersion: GameVersion): ItemState | null {
  return importItem(text, gameVersion)?.state ?? null;
}

export function importTarget(text: string, gameVersion: GameVersion): TargetSpec | null {
  const parsed = importItem(text, gameVersion);
  return parsed ? targetSpecFromItem(parsed.state) : null;
}

export interface StageTargetOption {
  readonly key: string;
  readonly origin: 'target-item' | 'catalog';
  readonly target: CraftTarget;
}

/** Explorer mode as the UI knows it; `side` only chooses the tab to open. */
export type ExplorerMode =
  | { readonly kind: 'inspect' }
  | { readonly kind: 'edit-source'; readonly side: 'prefix' | 'suffix'; readonly replaceIndex?: number }
  | { readonly kind: 'edit-target'; readonly side: 'prefix' | 'suffix' };

export interface WorkspaceInput {
  readonly session: CraftSession;
  readonly tool: ToolSelection;
  readonly stageTargetKey: string | null;
  readonly explorerMode: ExplorerMode;
}

/** What the source setup form needs: supported fields, per-modifier problems and tier choices. */
export interface SourceSetupView {
  /** null when the source base is not in this game version (e.g. an unrecognised import). */
  readonly fields: ItemSetupFields | null;
  readonly issues: ReadonlyMap<number, readonly ExclusionReason[]>;
  readonly tierOptions: ReadonlyMap<number, readonly TierOption[]>;
}

export interface WorkspaceAnalysis {
  readonly view: CraftDbView;
  readonly sourceSetup: SourceSetupView | null;
  /** A target on another base is shown with a warning and never planned towards. */
  readonly targetBase: TargetBaseCheck;
  readonly tool: ResolvedTool;
  /** Pool of the active tool on the current item (null without a ready tool). */
  readonly pool: EligiblePool | null;
  /** Why clicking the current item would do nothing; null when the click would apply. */
  readonly blockedBy: ApplyRejection | null;
  readonly explorer: PoolExplorer | null;
  readonly comparison: ItemComparison | null;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTarget: StageTargetOption | null;
  readonly probability: ProbabilityResult | null;
  readonly explanation: readonly ExplanationStep[];
}

export function analyzeWorkspace(input: WorkspaceInput): WorkspaceAnalysis {
  const { session } = input;
  const view = craftDb.forVersion(session.gameVersion);
  const tool = resolveTool(view, input.tool);
  const actionId = tool.status === 'ready' ? tool.action.id : null;

  const inspect = poolForMode(session, craftDb, { kind: 'inspect', actionId });
  const pool = inspect.pool;
  const blockedBy = pool ? checkApplicable(pool) : null;

  const mode = toPoolMode(input.explorerMode, actionId);
  const explorerPool = mode.kind === 'inspect' ? pool : poolForMode(session, craftDb, mode).pool;
  const explorer = explorerPool?.status === 'ready' ? explorePool(explorerPool, view) : null;

  const comparison =
    session.current && session.target ? compareToTarget(session.current, session.target, view) : null;
  const targetBase = targetBaseCheck(session.source ?? session.current, session.target);
  const stageTargets = stageTargetOptions(view, targetBase === 'mismatch' ? null : comparison);
  const stageTarget = stageTargets.find((o) => o.key === input.stageTargetKey) ?? stageTargets[0] ?? null;
  const probability = pool && stageTarget ? calculateTargetProbability(pool, stageTarget.target) : null;
  const explanation =
    pool && stageTarget && probability ? explainCalculation(pool, stageTarget.target, probability) : [];

  return {
    view,
    sourceSetup: sourceSetupView(session),
    targetBase,
    tool,
    pool,
    blockedBy,
    explorer,
    comparison,
    stageTargets,
    stageTarget,
    probability,
    explanation,
  };
}

function sourceSetupView(session: CraftSession): SourceSetupView | null {
  const source = session.source;
  if (!source) return null;
  const { gameVersion } = session;
  return {
    fields: itemSetupFields(craftDb.forVersion(gameVersion), source),
    issues: sourceModifierIssues(craftDb, gameVersion, source),
    tierOptions: new Map(source.explicits.map((_, i) => [i, sourceTierOptions(craftDb, gameVersion, source, i)])),
  };
}

function toPoolMode(mode: ExplorerMode, actionId: string | null): PoolMode {
  switch (mode.kind) {
    case 'inspect':
      return { kind: 'inspect', actionId };
    case 'edit-source':
      return mode.replaceIndex === undefined
        ? { kind: 'edit-source' }
        : { kind: 'edit-source', replaceIndex: mode.replaceIndex };
    case 'edit-target':
      return { kind: 'edit-target' };
  }
}

/** Outstanding target requirements first, then the catalog targets of the dataset. */
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
