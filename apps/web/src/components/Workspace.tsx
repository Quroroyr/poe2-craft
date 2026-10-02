'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ItemBaseId,
  type ItemState,
  type ModifierDefinition,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import {
  EMPTY_TOOL,
  addModifierToTarget,
  applyManualEdit,
  applySourcePick,
  applyTargetPick,
  applyToolStep,
  createItemFromBase,
  createSession,
  hasCraftHistory,
  hasManualEdits,
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
  type ManualEdit,
  type SessionStep,
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
import { buildModMenu, type MenuIntent, type ModMenuTarget } from '@/lib/mod-menu';
import { INITIAL_PRICE_INPUTS, snapshotFromInputs, type PriceInputs } from '@/lib/prices';
import { applyNotice, currentItemBadges, randomSeed, type WorkspaceNotice } from '@/lib/session-ui';
import { MANUAL_OPERATION_LABEL, applyRejectionText, exclusionText, manualEditRejectionText, manualEditText } from '@/lib/texts';
import { BaseSelector } from './BaseSelector';
import { ContextMenu } from './ContextMenu';
import { CurrentItemPanel, type CraftFeedback } from './CurrentItemPanel';
import { DataPanel } from './DataPanel';
import { ExplanationPanel } from './ExplanationPanel';
import { HistoryPanel } from './HistoryPanel';
import { Masthead } from './Masthead';
import { ManualEditDialog } from './ManualEditDialog';
import { ModifierPoolPanel, type PoolFocus } from './ModifierPoolPanel';
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
  const [menu, setMenu] = useState<{ target: ModMenuTarget; x: number; y: number } | null>(null);
  const [poolFocus, setPoolFocus] = useState<PoolFocus | null>(null);
  // A manual edit of the current item waits here until the one-time notice is confirmed.
  const [pendingEdit, setPendingEdit] = useState<ManualEdit | null>(null);
  const [manualEditAcknowledged, setManualEditAcknowledged] = useState(false);
  const explorerRef = useRef<HTMLDivElement>(null);
  // When each step was applied. Kept by the page: the session itself stays free of clocks.
  const stepTimes = useRef(new WeakMap<SessionStep, number>());

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

  const scrollToPool = () =>
    requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const explore = (mode: ExplorerMode) => {
    setExplorerMode(mode);
    setPoolFocus(null);
    scrollToPool();
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
    } else if (explorerMode.kind === 'edit-current') {
      runManualEdit({ operation: 'replace', index: explorerMode.replaceIndex, modifierId: definition.id });
    }
  };

  // Undo / redo / reset can take away the modifier a "replace from pool" was aimed at.
  useEffect(() => {
    if (explorerMode.kind === 'edit-current' && !session.current?.explicits[explorerMode.replaceIndex]) {
      setExplorerMode(INSPECT);
    }
  }, [explorerMode, session.current]);

  /** Sandbox edit of the current item: a ManualEditStep, never a craft and never spending (ADR 009). */
  const applyManual = (edit: ManualEdit) => {
    const result = applyManualEdit(session, craftDb, edit);
    if (result.status === 'rejected') {
      setNotice({ tone: 'bad', text: `Правка не применена. ${manualEditRejectionText(result.reason, result.reasons, view)}` });
      return;
    }
    stepTimes.current.set(result.step, Date.now());
    setSession(result.session);
    setFeedback(null);
    setNotice({
      tone: 'ok',
      text: `Шаг ${result.step.index} · ручная правка (${MANUAL_OPERATION_LABEL[edit.operation].toLowerCase()}): ${manualEditText(result.step)}. Это не крафт — валюта не потрачена.`,
    });
    // A removal shifts positions: a "replace from pool" aimed at one of them no longer applies.
    if (edit.operation === 'remove' && explorerMode.kind === 'edit-current') setExplorerMode(INSPECT);
  };
  const runManualEdit = (edit: ManualEdit) => {
    if (manualEditAcknowledged) applyManual(edit);
    else setPendingEdit(edit);
  };

  const showInPool = (modifierId: string) => {
    const definition = view.getModifier(modifierId);
    if (!definition) return;
    setExplorerMode(INSPECT);
    setPoolFocus((prev) => ({
      modifierId,
      tab: definition.side,
      familyKey: definition.groupIds.join('+'),
      nonce: (prev?.nonce ?? 0) + 1,
    }));
    scrollToPool();
  };

  const addToTarget = (modifierId: string, fractured: boolean) => {
    const fallback = session.source ?? session.current;
    const target = session.target ?? targetForSource(fallback);
    const result = addModifierToTarget(craftDb, session.gameVersion, target, fallback, modifierId, fractured);
    if (result.status === 'not-allowed') {
      const why = result.reasons.map((r) => exclusionText(r, view)).join('; ') || 'цель не может это принять';
      setNotice({ tone: 'bad', text: `В цель не добавлено: ${why}.` });
      return;
    }
    if (result.status !== 'already') editTarget(result.target);
  };

  const runIntent = (intent: MenuIntent) => {
    switch (intent.kind) {
      case 'manual-edit':
        return runManualEdit(intent.edit);
      case 'source':
        return editSource(intent.source);
      case 'target':
        return editTarget(intent.target);
      case 'explore':
        return explore(intent.mode);
      case 'show-in-pool':
        return showInPool(intent.modifierId);
      case 'add-to-target':
        return addToTarget(intent.modifierId, intent.fractured);
    }
  };
  const closeMenu = useCallback(() => setMenu(null), []);
  // Built from the live session on every render, so the menu never acts on a stale item.
  const menuModel = menu
    ? buildModMenu(menu.target, { session, db: craftDb, view, poolAvailable: analysis.pool?.status === 'ready' })
    : null;
  const openMenu = (target: ModMenuTarget, x: number, y: number) => setMenu({ target, x, y });

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
  const freshIndex = feedback?.tone === 'ok' && lastStep?.kind === 'craft' ? lastStep.after.explicits.length - 1 : null;

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
            onModMenu={(index, x, y) => openMenu({ scope: 'source', index }, x, y)}
            menuIndex={menu?.target.scope === 'source' ? menu.target.index : null}
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
            onModMenu={(index, x, y) => openMenu({ scope: 'current', index }, x, y)}
            menuIndex={menu?.target.scope === 'current' ? menu.target.index : null}
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
            onModMenu={(requirementId, x, y) => openMenu({ scope: 'target', requirementId }, x, y)}
            menuRequirementId={menu?.target.scope === 'target' ? menu.target.requirementId : null}
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
              focus={poolFocus}
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
            hasManualEdits={hasManualEdits(session)}
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

      {menu && menuModel && <ContextMenu model={menuModel} x={menu.x} y={menu.y} onIntent={runIntent} onClose={closeMenu} />}
      <ManualEditDialog
        open={pendingEdit !== null}
        onConfirm={() => {
          setManualEditAcknowledged(true);
          if (pendingEdit) applyManual(pendingEdit);
          setPendingEdit(null);
        }}
        onCancel={() => setPendingEdit(null)}
      />

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
