/**
 * Composition root of the web app: wires parser, CraftDB and probability engine together.
 * Contains no game rules — only the order in which the packages are called.
 */
import { akoyanSpearFixture, createCraftDb, type CraftDbView } from '@poe2-craft/craft-db';
import type { CraftTarget, GameVersion } from '@poe2-craft/craft-domain';
import { parseItem, type ItemParseResult } from '@poe2-craft/item-parser';
import {
  buildEligiblePool,
  calculateTargetProbability,
  explainCalculation,
  type EligiblePool,
  type ExplanationStep,
  type ProbabilityResult,
} from '@poe2-craft/probability-engine';

export const craftDb = createCraftDb(akoyanSpearFixture);
export const DEFAULT_GAME_VERSION: GameVersion =
  craftDb.supportedVersions[craftDb.supportedVersions.length - 1] ?? '0.5.0';

export interface StageInput {
  readonly itemText: string;
  readonly gameVersion: GameVersion;
  readonly actionId: string;
  readonly targetId: string;
}

export interface StageAnalysis {
  readonly view: CraftDbView;
  readonly parse: ItemParseResult;
  readonly target: CraftTarget | null;
  readonly pool: EligiblePool;
  readonly probability: ProbabilityResult | null;
  readonly explanation: readonly ExplanationStep[];
}

export function analyzeStage(input: StageInput): StageAnalysis {
  const view = craftDb.forVersion(input.gameVersion);
  const parse = parseItem(input.itemText, view);
  const pool = buildEligiblePool({
    item: parse.state,
    context: { gameVersion: input.gameVersion },
    db: craftDb,
    actionId: input.actionId,
  });
  const target = view.getTarget(input.targetId) ?? null;
  const probability = target ? calculateTargetProbability(pool, target) : null;
  const explanation = target && probability ? explainCalculation(pool, target, probability) : [];
  return { view, parse, target, pool, probability, explanation };
}
