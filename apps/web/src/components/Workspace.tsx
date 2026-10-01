'use client';

import { useMemo, useState } from 'react';
import type { ConsumableAmount } from '@poe2-craft/craft-domain';
import {
  applyStep,
  createSession,
  sessionSpent,
  startFromSource,
  undoLastStep,
  type CraftSession,
} from '@poe2-craft/craft-session';
import { calculateAttemptCost, calculateStageCost } from '@poe2-craft/economy';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { DEFAULT_GAME_VERSION, analyzeWorkspace, craftDb } from '@/lib/analyze';
import { INITIAL_PRICE_INPUTS, snapshotFromInputs, type PriceInputs } from '@/lib/prices';
import {
  applyNotice,
  currentItemBadges,
  randomSeed,
  targetItemBadges,
  type WorkspaceNotice,
} from '@/lib/session-ui';
import { ComparePanel } from './ComparePanel';
import { CostPanel } from './CostPanel';
import { CurrentItemPanel } from './CurrentItemPanel';
import { DataPanel } from './DataPanel';
import { ExplanationPanel } from './ExplanationPanel';
import { HistoryPanel } from './HistoryPanel';
import { ItemPastePanel } from './ItemPastePanel';
import { MethodsPanel } from './MethodsPanel';
import { PoolExplorerPanel } from './PoolExplorerPanel';
import { ProbabilityPanel } from './ProbabilityPanel';

const DEFAULT_ACTION = 'action.add-random-modifier';

const defaultCost = (gameVersion: string, actionId: string): readonly ConsumableAmount[] =>
  craftDb.forVersion(gameVersion).getAction(actionId)?.defaultCost ?? [];

export function Workspace() {
  const [sourceText, setSourceText] = useState(SAMPLE_ITEMS[0]?.text ?? '');
  const [targetText, setTargetText] = useState(SAMPLE_TARGET_ITEMS[0]?.text ?? '');
  const [session, setSession] = useState<CraftSession>(() =>
    createSession({ gameVersion: DEFAULT_GAME_VERSION, seed: randomSeed() }),
  );
  /** Source text the current session was started from (meaningful once a step exists). */
  const [startedFrom, setStartedFrom] = useState(sourceText);
  const [actionId, setActionId] = useState(DEFAULT_ACTION);
  const [stageTargetKey, setStageTargetKey] = useState<string | null>(null);
  const [costLines, setCostLines] = useState(() => defaultCost(DEFAULT_GAME_VERSION, DEFAULT_ACTION));
  const [priceInputs, setPriceInputs] = useState<PriceInputs>(INITIAL_PRICE_INPUTS);
  const [pricesEdited, setPricesEdited] = useState(false);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);

  const analysis = useMemo(
    () => analyzeWorkspace({ sourceText, targetText, session, actionId, stageTargetKey }),
    [sourceText, targetText, session, actionId, stageTargetKey],
  );
  const { view, probability } = analysis;
  const live = analysis.session;

  const snapshot = useMemo(() => snapshotFromInputs(priceInputs, pricesEdited), [priceInputs, pricesEdited]);
  const attemptCost = useMemo(() => calculateAttemptCost(costLines, snapshot), [costLines, snapshot]);
  const stageCost = useMemo(
    () => (probability?.status === 'ok' ? calculateStageCost(probability.probability, attemptCost.total) : null),
    [probability, attemptCost.total],
  );
  const spent = useMemo(() => sessionSpent(live), [live]);
  const sourceChanged = live.steps.length > 0 && startedFrom !== sourceText;

  const restart = () => {
    setSession(startFromSource(live, analysis.source?.state ?? null));
    setStartedFrom(sourceText);
    setNotice(null);
  };
  const apply = () => {
    const result = applyStep(live, { db: craftDb, actionId, cost: attemptCost });
    if (result.status === 'applied' && live.steps.length === 0) setStartedFrom(sourceText);
    setSession(result.session);
    setNotice(applyNotice(result, view));
  };
  const undo = () => {
    setSession(undoLastStep(live));
    setNotice(null);
  };
  const changeAction = (id: string) => {
    setActionId(id);
    setCostLines(defaultCost(live.gameVersion, id));
  };
  const changeVersion = (gameVersion: string) => {
    // Items reference modifiers by id; mixing patches inside one session would be meaningless.
    setSession(createSession({ gameVersion, seed: live.seed }));
    setNotice(null);
  };

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>PoE 2 Craft Planner</h1>
          <p className="masthead-sub">Рабочий стол крафта: исходный предмет → текущий → целевой. Только Path of Exile 2.</p>
        </div>
        {view.info.kind === 'fixture' && (
          <p className="fixture-banner" role="note">
            <strong>Демо-данные и демо-симуляция.</strong> Тиры, уровни и веса модов придуманы для проверки движка;
            «Применить» разыгрывает упрощённую модель, а не реальную механику PoE 2.
          </p>
        )}
      </header>

      <main className="layout">
        <section className="workspace" aria-label="Рабочий стол">
          <div className="ws-source">
            <ItemPastePanel
              id="source-text"
              title="Исходный предмет"
              step="1"
              hint="База, с которой начинаем крафт"
              text={sourceText}
              onText={setSourceText}
              samples={SAMPLE_ITEMS}
              parse={analysis.source}
              view={view}
            />
          </div>
          <div className="ws-current">
            <CurrentItemPanel
              item={analysis.current}
              view={view}
              badges={currentItemBadges(live, analysis.comparison)}
              stepCount={live.steps.length}
              actionName={view.getAction(actionId)?.name ?? null}
              stageTargetLabel={analysis.stageTarget?.target.label ?? null}
              probability={probability}
              attemptCost={attemptCost}
              notice={notice}
              sourceChanged={sourceChanged}
              onApply={apply}
              onUndo={undo}
              onRestart={restart}
            />
          </div>
          <div className="ws-target">
            <ItemPastePanel
              id="target-text"
              title="Целевой предмет"
              step="3"
              hint="Пример того, что хотим получить"
              text={targetText}
              onText={setTargetText}
              samples={SAMPLE_TARGET_ITEMS}
              parse={analysis.target}
              view={view}
              badges={targetItemBadges(analysis.comparison)}
              aside={
                analysis.comparison && (
                  <span className="badge num">
                    {analysis.comparison.matched}/{analysis.comparison.total}
                  </span>
                )
              }
            />
          </div>
        </section>

        <div className="row-2">
          <MethodsPanel
            db={craftDb}
            view={view}
            actionId={actionId}
            onAction={changeAction}
            gameVersion={live.gameVersion}
            onGameVersion={changeVersion}
            stageTargets={analysis.stageTargets}
            stageTargetKey={analysis.stageTarget?.key ?? null}
            onStageTarget={setStageTargetKey}
          />
          <CostPanel
            view={view}
            spent={spent}
            probability={probability}
            lines={costLines}
            onLines={setCostLines}
            priceInputs={priceInputs}
            onPrice={(id, text) => {
              setPriceInputs((prev) => ({ ...prev, [id]: text }));
              setPricesEdited(true);
            }}
            attemptCost={attemptCost}
            stageCost={stageCost}
            priceSource={snapshot.source}
          />
        </div>

        <div className="row-2">
          <HistoryPanel steps={live.steps} view={view} />
          <ComparePanel comparison={analysis.comparison} hasTarget={analysis.target !== null} />
        </div>

        <PoolExplorerPanel explorer={analysis.explorer} target={analysis.stageTarget?.target ?? null} view={view} />

        <div className="row-2">
          <ProbabilityPanel result={probability} view={view} />
          <ExplanationPanel steps={analysis.explanation} view={view} />
        </div>
        <DataPanel view={view} probability={probability} />
      </main>
    </div>
  );
}
