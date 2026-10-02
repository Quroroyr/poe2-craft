'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ItemBaseId,
  type ItemState,
  type ModifierDefinition,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import {
  EMPTY_TOOL,
  applySourcePick,
  applyTargetPick,
  applyToolStep,
  createItemFromBase,
  createSession,
  hasCraftHistory,
  isSourceOutOfSync,
  redoStep,
  resetToSource,
  selectCurrency,
  sessionSpent,
  sessionSpentByConsumable,
  setSource,
  targetForSource,
  undoLastStep,
  undoToStep,
  withTarget,
  type CraftSession,
  type CraftStepRecord,
  type ToolSelection,
} from '@poe2-craft/craft-session';
import { calculateAttemptCost, calculateStageCost } from '@poe2-craft/economy';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import {
  DEFAULT_GAME_VERSION,
  analyzeWorkspace,
  craftDb,
  importSource,
  importTarget,
  type ExplorerMode,
} from '@/lib/analyze';
import { heldTool } from '@/lib/held-tool';
import { INITIAL_PRICE_INPUTS, snapshotFromInputs, type PriceInputs } from '@/lib/prices';
import { applyNotice, currentItemBadges, randomSeed, type WorkspaceNotice } from '@/lib/session-ui';
import { applyRejectionText } from '@/lib/texts';
import { BaseSelector } from './BaseSelector';
import { CurrentItemPanel, type CraftFeedback } from './CurrentItemPanel';
import { DataPanel } from './DataPanel';
import { ExplanationPanel } from './ExplanationPanel';
import { HistoryPanel } from './HistoryPanel';
import { Masthead } from './Masthead';
import { ModifierPoolPanel } from './ModifierPoolPanel';
import { ProbabilityPanel } from './ProbabilityPanel';
import { SourcePanel } from './SourcePanel';
import { SpendingPanel } from './SpendingPanel';
import { TargetPanel } from './TargetPanel';
import { ToolPalette } from './ToolPalette';

const INSPECT: ExplorerMode = { kind: 'inspect' };
const DEFAULT_ITEM_LEVEL = 82;

function initialSession(): CraftSession {
  return createSession({
    gameVersion: DEFAULT_GAME_VERSION,
    seed: randomSeed(),
    source: importSource(SAMPLE_ITEMS[0]?.text ?? '', DEFAULT_GAME_VERSION),
    target: importTarget(SAMPLE_TARGET_ITEMS[0]?.text ?? '', DEFAULT_GAME_VERSION),
  });
}

/** Shortcuts must not hijack native undo inside text fields. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function Workspace() {
  const [session, setSession] = useState<CraftSession>(initialSession);
  const [tool, setTool] = useState<ToolSelection>(() => selectCurrency(EMPTY_TOOL, 'currency.exalted-orb'));
  const [stageTargetKey, setStageTargetKey] = useState<string | null>(null);
  const [explorerMode, setExplorerMode] = useState<ExplorerMode>(INSPECT);
  const [priceInputs, setPriceInputs] = useState<PriceInputs>(INITIAL_PRICE_INPUTS);
  const [pricesEdited, setPricesEdited] = useState(false);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [feedback, setFeedback] = useState<CraftFeedback | null>(null);
  const [baseSelectorOpen, setBaseSelectorOpen] = useState(false);
  const explorerRef = useRef<HTMLDivElement>(null);
  // When each step was applied. Kept by the page: the session itself stays free of clocks.
  const stepTimes = useRef(new WeakMap<CraftStepRecord, number>());

  const analysis = useMemo(
    () => analyzeWorkspace({ session, tool, stageTargetKey, explorerMode }),
    [session, tool, stageTargetKey, explorerMode],
  );
  const { view, probability, comparison } = analysis;
  const action = analysis.tool.status === 'ready' ? analysis.tool.action : null;

  const snapshot = useMemo(() => snapshotFromInputs(priceInputs, pricesEdited), [priceInputs, pricesEdited]);
  const attemptCost = useMemo(() => (action ? calculateAttemptCost(action.defaultCost, snapshot) : null), [action, snapshot]);
  const stageCost = useMemo(
    () =>
      probability?.status === 'ok' && attemptCost ? calculateStageCost(probability.probability, attemptCost.total) : null,
    [probability, attemptCost],
  );
  const spent = useMemo(() => sessionSpent(session), [session]);
  const spentLines = useMemo(() => sessionSpentByConsumable(session), [session]);

  /** Any history move ends the "just clicked" moment. */
  const clearMoment = () => {
    setNotice(null);
    setFeedback(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        setSession(undoLastStep);
        clearMoment();
      } else if ((e.ctrlKey || e.metaKey) && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        setSession(redoStep);
        clearMoment();
      } else if (key === 'escape') {
        setExplorerMode(INSPECT);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const craft = () => {
    const result = applyToolStep(session, { db: craftDb, tool, prices: snapshot });
    const id = (feedback?.id ?? 0) + 1;
    setSession(result.session);
    setFeedback({ id, tone: result.status === 'applied' ? 'ok' : 'bad' });
    if (result.status === 'applied') {
      stepTimes.current.set(result.step, Date.now());
      setNotice(applyNotice(result, view));
    } else if (result.reason === 'no-tool') {
      setNotice({ tone: 'bad', text: 'Сначала возьмите валюту в полосе инструментов.' });
    } else if (result.reason === 'incompatible-tool') {
      setNotice({ tone: 'bad', text: 'Выбранный Omen не действует на эту валюту — предмет не изменён, валюта не потрачена.' });
    } else if (result.reason === 'unsupported-tool') {
      setNotice({ tone: 'bad', text: 'Эта механика ещё не смоделирована — предмет не изменён, валюта не потрачена.' });
    } else {
      setNotice({ tone: 'bad', text: `Предмет не изменён, валюта не потрачена. ${applyNotice(result, view).text}` });
    }
  };

  const explore = (mode: ExplorerMode) => {
    setExplorerMode(mode);
    requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const editSource = (source: ItemState | null) => setSession((s) => setSource(s, source));
  const editTarget = (target: TargetSpec | null) => setSession((s) => withTarget(s, target));

  const chooseBase = (baseId: ItemBaseId) => {
    const source = createItemFromBase(view, baseId, session.source?.itemLevel ?? DEFAULT_ITEM_LEVEL);
    if (!source) return;
    setSession((s) => {
      const next = setSource(s, source);
      // An empty target simply follows the new base; one with requirements is kept and warned about.
      const followsBase = !s.target || s.target.requirements.length === 0;
      return followsBase ? withTarget(next, targetForSource(source)) : next;
    });
    setBaseSelectorOpen(false);
    setExplorerMode(INSPECT);
    clearMoment();
  };

  /** A click on a tier while editing. The pool stays open on the same tab, family and filters. */
  const pick = (definition: ModifierDefinition) => {
    const option = analysis.picks?.get(definition.id);
    if (!option?.allowed) return;
    if (explorerMode.kind === 'edit-source' && session.source) {
      editSource(applySourcePick(session.source, option));
    } else if (explorerMode.kind === 'edit-target') {
      editTarget(applyTargetPick(session.target ?? targetForSource(session.source), option));
    }
  };

  const changeVersion = (gameVersion: string) => {
    // Items refer to modifiers by stable id, so source and target survive; the crafted history does not.
    setSession((s) => createSession({ gameVersion, seed: s.seed, source: s.source, target: s.target }));
    clearMoment();
  };

  const undo = () => {
    setSession(undoLastStep);
    clearMoment();
  };
  const redo = () => {
    setSession(redoStep);
    clearMoment();
  };

  const blockedReason = analysis.blockedBy ? applyRejectionText(analysis.blockedBy) : null;
  const held = heldTool(analysis.tool, blockedReason);
  const outOfSync = isSourceOutOfSync(session);
  const lastStep = session.steps[session.steps.length - 1];
  const freshIndex = feedback?.tone === 'ok' && lastStep ? lastStep.after.explicits.length - 1 : null;

  return (
    <div className="page">
      <Masthead db={craftDb} gameVersion={session.gameVersion} fixture={view.info.kind === 'fixture'} onGameVersion={changeVersion} />

      <main className="layout">
        <section className="row-items" aria-label="Предметы">
          <SourcePanel
            source={session.source}
            view={view}
            setup={analysis.sourceSetup}
            explorerMode={explorerMode}
            craftStarted={hasCraftHistory(session)}
            onImport={(text) => editSource(importSource(text, session.gameVersion))}
            onEdit={editSource}
            onExplore={explore}
            onChooseBase={chooseBase}
            onOpenCatalog={() => setBaseSelectorOpen(true)}
            onClear={() => {
              const baseId = session.source?.baseId;
              if (baseId) chooseBase(baseId);
            }}
          />
          <CurrentItemPanel
            item={session.current}
            view={view}
            badges={currentItemBadges(session, comparison)}
            stepCount={session.steps.length}
            redoCount={session.redoStack.length}
            tool={held}
            feedback={feedback}
            freshIndex={freshIndex}
            notice={notice}
            sourceOutOfSync={outOfSync}
            canReset={hasCraftHistory(session) || outOfSync}
            onCraft={craft}
            onUndo={undo}
            onRedo={redo}
            onReset={() => {
              setSession(resetToSource);
              clearMoment();
            }}
          />
          <TargetPanel
            target={session.target}
            outlook={analysis.outlook}
            view={view}
            explorerMode={explorerMode}
            baseCheck={analysis.targetBase}
            sourceBaseName={session.source?.baseName ?? null}
            onImport={(text) => editTarget(importTarget(text, session.gameVersion))}
            onEdit={editTarget}
            onCreate={() => editTarget(targetForSource(session.source))}
            onExplore={explore}
          />
        </section>

        <ToolPalette
          view={view}
          palette={analysis.palette}
          selection={tool}
          onSelect={setTool}
          resolved={analysis.tool}
          priceInputs={priceInputs}
          attemptCost={attemptCost}
          probability={probability}
        />

        <section className="row-bottom" aria-label="Пул, история и затраты">
          <div ref={explorerRef} className={`pool-slot${explorerMode.kind === 'inspect' ? '' : ' explorer-editing'}`}>
            <ModifierPoolPanel
              key={
                explorerMode.kind === 'inspect'
                  ? 'inspect'
                  : `${explorerMode.kind}-${explorerMode.side}-${'replaceIndex' in explorerMode ? explorerMode.replaceIndex : ''}`
              }
              explorer={analysis.explorer}
              mode={explorerMode}
              view={view}
              highlightIds={new Set(analysis.stageTarget?.target.modifierIds ?? [])}
              picks={analysis.picks}
              toolLabel={held ? held.icons.map((i) => i.name).join(' + ') : null}
              onPick={pick}
              onExit={() => setExplorerMode(INSPECT)}
            />
          </div>
          <HistoryPanel
            session={session}
            view={view}
            timeOf={(step) => stepTimes.current.get(step)}
            onUndo={undo}
            onRedo={redo}
            onUndoTo={(index) => {
              setSession((s) => undoToStep(s, index));
              clearMoment();
            }}
          />
          <SpendingPanel
            view={view}
            spent={spent}
            spentLines={spentLines}
            attemptCost={attemptCost}
            stageCost={stageCost}
            probability={probability}
            stageTargets={analysis.stageTargets}
            stageTargetKey={analysis.stageTarget?.key ?? null}
            onStageTarget={setStageTargetKey}
            priceInputs={priceInputs}
            pricesAreMock={!pricesEdited}
            onPrice={(id, text) => {
              setPriceInputs((prev) => ({ ...prev, [id]: text }));
              setPricesEdited(true);
            }}
          />
        </section>

        <details className="calc-details">
          <summary>Как посчитано: вероятность, объяснение и источники данных</summary>
          <div className="row-2">
            <ProbabilityPanel result={probability} view={view} />
            <ExplanationPanel steps={analysis.explanation} view={view} />
          </div>
          <DataPanel view={view} probability={probability} />
        </details>
      </main>

      <BaseSelector
        open={baseSelectorOpen}
        view={view}
        currentBaseId={session.source?.baseId ?? null}
        dropsModifiers={(session.source?.explicits.length ?? 0) > 0}
        onSelect={chooseBase}
        onClose={() => setBaseSelectorOpen(false)}
      />
    </div>
  );
}
