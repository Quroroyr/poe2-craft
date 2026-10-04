/**
 * Composition root of the web app: wires parser, CraftDB, probability engine and craft session.
 * Contains no game rules — only the order in which the packages are called.
 */
import { akoyanSpearFixture, productionDataset, createCraftDb, type CraftDb, type CraftDbView } from '@poe2-craft/craft-db';
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
  currentAddOptions,
  manualAddSlots,
  compareToTarget,
  itemSetupFields,
  outstandingTargetModifiers,
  poolForMode,
  resolveTool,
  sourceModifierIssues,
  sourcePickOptions,
  sourceTierOptions,
  targetBaseCheck,
  targetFromModifier,
  targetOutlook,
  targetPickOptions,
  toolPalette,
  type ApplyRejection,
  type CraftSession,
  type ItemComparison,
  type ItemSetupFields,
  type PickOptions,
  type PoolMode,
  type ResolvedTool,
  type TargetBaseCheck,
  type TargetOutlook,
  type TierOption,
  type ToolPalette,
  type ToolSelection,
} from '@poe2-craft/craft-session';

export const demoCraftDb = createCraftDb(akoyanSpearFixture);
export const craftDb = demoCraftDb;
export const realCraftDb = createCraftDb(productionDataset);
export const REAL_GAME_VERSION = realCraftDb.supportedVersions.at(-1)!;
export const DEFAULT_GAME_VERSION: GameVersion =
  craftDb.supportedVersions[craftDb.supportedVersions.length - 1] ?? '0.5.0';

export function importItem(text: string, gameVersion: GameVersion, db: CraftDb = craftDb): ItemParseResult | null {
  return text.trim() ? parseItem(text, db.forVersion(gameVersion)) : null;
}

/**
 * A pasted text is taken for a Path of Exile item only when the parser found its rarity or item
 * class header; anything else (a URL, a note) is ignored by the page-wide Ctrl+V.
 */
export function recognizeItem(text: string, gameVersion: GameVersion, db: CraftDb = craftDb): ItemParseResult | null {
  const result = importItem(text, gameVersion, db);
  return result && (result.state.rarity !== null || result.state.itemClassName !== null) ? result : null;
}

export function importSource(text: string, gameVersion: GameVersion, db: CraftDb = craftDb): ItemState | null {
  return importItem(text, gameVersion, db)?.state ?? null;
}

export function importTarget(text: string, gameVersion: GameVersion, db: CraftDb = craftDb): TargetSpec | null {
  const parsed = importItem(text, gameVersion, db);
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
  | { readonly kind: 'edit-target'; readonly side: 'prefix' | 'suffix' }
  /**
   * Manual edit of the current item (sandbox, ADR 009): replace the modifier at `replaceIndex`, or —
   * without it — add a new modifier of `side` to a free slot.
   */
  | { readonly kind: 'edit-current'; readonly side: 'prefix' | 'suffix'; readonly replaceIndex?: number };

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
  /** What a click on each tier does while editing the source or the target; null in inspect mode. */
  readonly picks: PickOptions | null;
  /** Free slots of the current item for "Add prefix / suffix" (manual edit); null when nothing can be added. */
  readonly currentAddSlots: ReturnType<typeof manualAddSlots>;
  readonly comparison: ItemComparison | null;
  /** Per-requirement state against the current item and target progress. */
  readonly outlook: TargetOutlook | null;
  readonly palette: ToolPalette;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTarget: StageTargetOption | null;
  readonly probability: ProbabilityResult | null;
  readonly explanation: readonly ExplanationStep[];
}

export function analyzeWorkspace(input: WorkspaceInput, craftDb: CraftDb = demoCraftDb): WorkspaceAnalysis {
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
  const picks = pickOptions(session, input.explorerMode, craftDb);

  const comparison =
    session.current && session.target ? compareToTarget(session.current, session.target, view) : null;
  const targetBase = targetBaseCheck(session.source ?? session.current, session.target);
  const outlook =
    session.current && comparison ? targetOutlook(craftDb, session.gameVersion, session.current, comparison) : null;
  const stageTargets = stageTargetOptions(view, targetBase === 'mismatch' ? null : comparison, session.current?.baseId);
  const stageTarget = stageTargets.find((o) => o.key === input.stageTargetKey) ?? stageTargets[0] ?? null;
  const probability = pool && stageTarget ? calculateTargetProbability(pool, stageTarget.target) : null;
  const explanation =
    pool && stageTarget && probability ? explainCalculation(pool, stageTarget.target, probability) : [];

  return {
    view,
    sourceSetup: sourceSetupView(session, craftDb),
    targetBase,
    tool,
    pool,
    blockedBy,
    explorer,
    picks,
    currentAddSlots: session.current ? manualAddSlots(craftDb, session.gameVersion, session.current) : null,
    comparison,
    outlook,
    palette: toolPalette(view),
    stageTargets,
    stageTarget,
    probability,
    explanation,
  };
}

function sourceSetupView(session: CraftSession, craftDb: CraftDb): SourceSetupView | null {
  const source = session.source;
  if (!source) return null;
  const { gameVersion } = session;
  return {
    fields: itemSetupFields(craftDb.forVersion(gameVersion), source),
    issues: sourceModifierIssues(craftDb, gameVersion, source),
    tierOptions: new Map(source.explicits.map((_, i) => [i, sourceTierOptions(craftDb, gameVersion, source, i)])),
  };
}

function pickOptions(session: CraftSession, mode: ExplorerMode, craftDb: CraftDb): PickOptions | null {
  const { gameVersion } = session;
  if (mode.kind === 'edit-source' && session.source) {
    return sourcePickOptions(craftDb, gameVersion, session.source, mode.replaceIndex);
  }
  if (mode.kind === 'edit-target' && session.target) {
    return targetPickOptions(craftDb, gameVersion, session.target, session.source);
  }
  if (mode.kind === 'edit-current' && session.current) {
    // The same item rules as the source setup, applied to the current item.
    return mode.replaceIndex === undefined
      ? currentAddOptions(craftDb, gameVersion, session.current, mode.side)
      : sourcePickOptions(craftDb, gameVersion, session.current, mode.replaceIndex);
  }
  return null;
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
    case 'edit-current':
      return mode.replaceIndex === undefined
        ? { kind: 'edit-current', side: mode.side }
        : { kind: 'edit-current', replaceIndex: mode.replaceIndex };
  }
}

/** Outstanding target requirements first, then the catalog targets of the dataset. */
function stageTargetOptions(view: CraftDbView, comparison: ItemComparison | null, baseId?: string | null): StageTargetOption[] {
  const fromItem = comparison
    ? outstandingTargetModifiers(comparison).flatMap((definition): StageTargetOption[] => {
        const target = targetFromModifier(view, definition.id, baseId);
        return target ? [{ key: `item:${definition.id}`, origin: 'target-item', target }] : [];
      })
    : [];
  const catalog = view
    .listTargets()
    .map((target): StageTargetOption => ({ key: `catalog:${target.id}`, origin: 'catalog', target }));
  return [...fromItem, ...catalog];
}
