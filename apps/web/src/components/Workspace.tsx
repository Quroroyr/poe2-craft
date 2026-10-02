'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { targetSpecFromItem, type ItemState, type ModifierDefinition, type TargetSpec } from '@poe2-craft/craft-domain';
import type { ItemParseResult } from '@poe2-craft/item-parser';
import {
  EMPTY_TOOL,
  addModifierToTarget,
  applyManualEdit,
  applySourcePick,
  applyTargetPick,
  applyToolStep,
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
  startFromSource,
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
import { useI18n } from '@/i18n/I18nProvider';
import { DEFAULT_GAME_VERSION, analyzeWorkspace, craftDb, recognizeItem, type ExplorerMode } from '@/lib/analyze';
import { heldTool } from '@/lib/held-tool';
import { buildModMenu, type MenuIntent, type ModMenuTarget } from '@/lib/mod-menu';
import { INITIAL_PRICE_INPUTS, snapshotFromInputs, type PriceInputs } from '@/lib/prices';
import { applyNotice, currentItemBadges, randomSeed, type WorkspaceNotice } from '@/lib/session-ui';
import { applyRejectionText, exclusionsText, manualEditRejectionText, manualEditText, manualOperationLabel } from '@/lib/texts';
import { ContextMenu } from './ContextMenu';
import { CurrentItemPanel, type CraftFeedback } from './CurrentItemPanel';
import { DataPanel } from './DataPanel';
import { ExplanationPanel } from './ExplanationPanel';
import { HistoryPanel } from './HistoryPanel';
import { ImportDialog } from './ImportDialog';
import { ImportPreview } from './ImportPreview';
import { ManualEditDialog } from './ManualEditDialog';
import { Masthead } from './Masthead';
import { ModifierPoolPanel, type PoolFocus } from './ModifierPoolPanel';
import { ProbabilityPanel } from './ProbabilityPanel';
import { SourceSetupSurface } from './SourceSetupSurface';
import { SpendingPanel } from './SpendingPanel';
import { StartScreen } from './StartScreen';
import { StartStrip } from './StartStrip';
import { TargetPanel } from './TargetPanel';
import { ToolPalette } from './ToolPalette';

const INSPECT: ExplorerMode = { kind: 'inspect' };

/** A first visit starts empty: no source, no current item, no target, no history. */
export function emptySession(gameVersion = DEFAULT_GAME_VERSION): CraftSession {
  return createSession({ gameVersion, seed: randomSeed(), source: null, target: null });
}

/** Shortcuts must not hijack native undo or paste inside text fields. */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The entry flows around the session. UI state only — the domain knows nothing of them:
 * - start:  no current item yet → start screen (Import / Create) next to the target;
 * - setup:  the starting item edited on its own surface (create a new one, or edit the active one);
 * - active: the current item is the large workbench, the target stays beside it.
 * Import previews and confirmations are dialogs over any of these.
 */
type Surface = { readonly kind: 'setup'; readonly purpose: 'create' | 'edit' } | null;

interface WorkspaceProps {
  /** For tests and demos: start from a prepared session instead of an empty one. */
  readonly initialSession?: CraftSession;
}

export function Workspace(props: WorkspaceProps) {
  const { t, locale } = useI18n();
  const [session, setSession] = useState<CraftSession>(() => props.initialSession ?? emptySession());
  const [surface, setSurface] = useState<Surface>(null);
  const [importPurpose, setImportPurpose] = useState<'source' | 'target' | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ItemParseResult | null>(null);
  const [tool, setTool] = useState<ToolSelection>(() => selectCurrency(EMPTY_TOOL, 'currency.exalted-orb'));
  const [stageTargetKey, setStageTargetKey] = useState<string | null>(null);
  const [explorerMode, setExplorerMode] = useState<ExplorerMode>(INSPECT);
  const [priceInputs, setPriceInputs] = useState<PriceInputs>(INITIAL_PRICE_INPUTS);
  const [pricesEdited, setPricesEdited] = useState(false);
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const [feedback, setFeedback] = useState<CraftFeedback | null>(null);
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
  const hasItem = session.current !== null;

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

  // A notice is text in the language it was written in: switching the language drops it.
  useEffect(() => setNotice(null), [locale]);

  // Page-wide keys and paste read the latest state through this ref (listeners are bound once).
  const live = useRef({ busy: false, onPaste: (_text: string) => {} });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || live.current.busy) return;
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
    // Ctrl+V anywhere on the page (outside text fields) imports an item copied in the game.
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) || live.current.busy) return;
      const text = e.clipboardData?.getData('text') ?? '';
      if (text.trim()) live.current.onPaste(text);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
    };
  }, []);

  /** One entry for Ctrl+V, the Import button and the demo examples: recognise, then preview. */
  const beginImport = (text: string): boolean => {
    const result = recognizeItem(text, session.gameVersion);
    if (!result) return false;
    setImportPurpose(null);
    setImportError(null);
    setPreview(result);
    return true;
  };
  const submitImport = (text: string) => {
    if (importPurpose === 'target') {
      const result = recognizeItem(text, session.gameVersion);
      if (!result) return setImportError(t('import.notItem'));
      editTarget(targetSpecFromItem(result.state));
      setImportPurpose(null);
      setImportError(null);
      return;
    }
    if (!beginImport(text)) setImportError(t('import.notItem'));
  };
  live.current = {
    busy: surface !== null || importPurpose !== null || preview !== null || pendingEdit !== null,
    onPaste: (text) => {
      beginImport(text);
    },
  };

  /**
   * Starts a craft from a starting item: current = source, history and spending cleared. The target
   * is kept; an empty one follows the new base, one with requirements on another base is shown with
   * the existing mismatch warning (and not planned towards).
   */
  const startCraft = (source: ItemState) => {
    setSession((s) => {
      const next = startFromSource(s, source);
      const followsBase = s.target !== null && s.target.requirements.length === 0;
      return followsBase ? withTarget(next, targetForSource(source)) : next;
    });
    setExplorerMode(INSPECT);
    setPoolFocus(null);
    setMenu(null);
    clearMoment();
  };

  const craft = () => {
    const result = applyToolStep(session, { db: craftDb, tool, prices: snapshot });
    const id = (feedback?.id ?? 0) + 1;
    setSession(result.session);
    setFeedback({ id, tone: result.status === 'applied' ? 'ok' : 'bad' });
    if (result.status === 'applied') {
      stepTimes.current.set(result.step, Date.now());
      setNotice(applyNotice(t, result, view));
    } else if (result.reason === 'no-tool') {
      setNotice({ tone: 'bad', text: t('notice.noTool') });
    } else if (result.reason === 'incompatible-tool') {
      setNotice({ tone: 'bad', text: t('notice.incompatible') });
    } else if (result.reason === 'unsupported-tool') {
      setNotice({ tone: 'bad', text: t('notice.unsupported') });
    } else {
      setNotice({ tone: 'bad', text: t('notice.rejected', { reason: applyNotice(t, result, view).text }) });
    }
  };

  const scrollToPool = () =>
    requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const explore = (mode: ExplorerMode) => {
    setExplorerMode(mode);
    setPoolFocus(null);
    scrollToPool();
  };
  const editTarget = (target: TargetSpec | null) => setSession((s) => withTarget(s, target));

  /** A click on a tier while editing. The pool stays open on the same tab, family and filters. */
  const pick = (definition: ModifierDefinition) => {
    const option = analysis.picks?.get(definition.id);
    if (!option?.allowed) return;
    if (explorerMode.kind === 'edit-source' && session.source) {
      setSession((s) => setSource(s, applySourcePick(session.source!, option)));
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
      setNotice({ tone: 'bad', text: t('notice.manualRejected', { reason: manualEditRejectionText(t, result.reason, result.reasons, view) }) });
      return;
    }
    stepTimes.current.set(result.step, Date.now());
    setSession(result.session);
    setFeedback(null);
    setNotice({
      tone: 'ok',
      text: t('notice.manualApplied', {
        index: result.step.index,
        operation: manualOperationLabel(t, edit.operation),
        text: manualEditText(result.step),
      }),
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
      const why = exclusionsText(t, result.reasons, view) || t('notice.targetCannotTake');
      setNotice({ tone: 'bad', text: t('notice.targetNotAdded', { reason: why }) });
      return;
    }
    if (result.status !== 'already') editTarget(result.target);
  };

  const runIntent = (intent: MenuIntent) => {
    switch (intent.kind) {
      case 'manual-edit':
        return runManualEdit(intent.edit);
      case 'source':
        return setSession((s) => setSource(s, intent.source));
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
    ? buildModMenu(menu.target, { t, session, db: craftDb, view, poolAvailable: analysis.pool?.status === 'ready' })
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
  const resetCraft = () => {
    setSession(resetToSource);
    clearMoment();
  };

  const blockedReason = analysis.blockedBy ? applyRejectionText(t, analysis.blockedBy) : null;
  const held = heldTool(t, analysis.tool, blockedReason);
  const outOfSync = isSourceOutOfSync(session);
  const lastStep = session.steps[session.steps.length - 1];
  const freshIndex = feedback?.tone === 'ok' && lastStep?.kind === 'craft' ? lastStep.after.explicits.length - 1 : null;

  const pool = (
    <div ref={explorerRef} className={`pool-slot${explorerMode.kind === 'inspect' ? '' : ' explorer-editing'}`}>
      <ModifierPoolPanel
        key={
          explorerMode.kind === 'inspect'
            ? 'inspect'
            : `${explorerMode.kind}-${explorerMode.side}-${'replaceIndex' in explorerMode ? explorerMode.replaceIndex : ''}`
        }
        index={4}
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
  );

  return (
    <div className="page">
      <Masthead db={craftDb} gameVersion={session.gameVersion} fixture={view.info.kind === 'fixture'} onGameVersion={changeVersion} />

      <main className="layout">
        {surface ? (
          <SourceSetupSurface
            purpose={surface.purpose}
            initial={surface.purpose === 'edit' ? session.source : null}
            gameVersion={session.gameVersion}
            craftStarted={hasCraftHistory(session)}
            onCancel={() => setSurface(null)}
            onConfirm={(source) => {
              if (surface.purpose === 'create') startCraft(source);
              // Editing keeps v0.6 semantics: before the first step current follows; after it, out of sync until Reset.
              else setSession((s) => setSource(s, source));
              setSurface(null);
            }}
          />
        ) : (
          <>
            <section className={`row-main${hasItem ? '' : ' row-main-start'}`}>
              <div className="main-col">
                {hasItem ? (
                  <>
                    <StartStrip
                      source={session.source}
                      canReset={hasCraftHistory(session) || outOfSync}
                      onEdit={() => setSurface({ kind: 'setup', purpose: 'edit' })}
                      onReset={resetCraft}
                      onImportAnother={() => setImportPurpose('source')}
                    />
                    <CurrentItemPanel
                      item={session.current}
                      view={view}
                      badges={currentItemBadges(t, session, comparison)}
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
                      onReset={resetCraft}
                      onModMenu={(index, x, y) => openMenu({ scope: 'current', index }, x, y)}
                      menuIndex={menu?.target.scope === 'current' ? menu.target.index : null}
                    />
                  </>
                ) : (
                  <StartScreen onImport={() => setImportPurpose('source')} onCreate={() => setSurface({ kind: 'setup', purpose: 'create' })} />
                )}
              </div>
              <TargetPanel
                target={session.target}
                outlook={analysis.outlook}
                view={view}
                explorerMode={explorerMode}
                baseCheck={analysis.targetBase}
                sourceBaseName={session.source?.baseName ?? null}
                hasItem={hasItem}
                onEdit={editTarget}
                onBuild={() => {
                  editTarget(targetForSource(session.source ?? session.current));
                  explore({ kind: 'edit-target', side: 'prefix' });
                }}
                onImport={() => setImportPurpose('target')}
                onCopyCurrent={() => session.current && editTarget(targetSpecFromItem(session.current))}
                onExplore={explore}
                onModMenu={(requirementId, x, y) => openMenu({ scope: 'target', requirementId }, x, y)}
                menuRequirementId={menu?.target.scope === 'target' ? menu.target.requirementId : null}
              />
            </section>

            {hasItem && (
              <>
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

                <section className="row-bottom">
                  {pool}
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
                  <summary>{t('calc.summary')}</summary>
                  <div className="row-2">
                    <ProbabilityPanel result={probability} view={view} />
                    <ExplanationPanel steps={analysis.explanation} view={view} />
                  </div>
                  <DataPanel view={view} probability={probability} />
                </details>
              </>
            )}
            {/* Before a craft starts, a target being built still needs its picker. */}
            {!hasItem && explorerMode.kind === 'edit-target' && <section className="row-bottom row-bottom-solo">{pool}</section>}
          </>
        )}
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
      <ImportDialog
        purpose={importPurpose}
        error={importError}
        onSubmit={submitImport}
        onCancel={() => {
          setImportPurpose(null);
          setImportError(null);
        }}
      />
      <ImportPreview
        result={preview}
        replacing={hasItem}
        view={view}
        onCancel={() => setPreview(null)}
        onConfirm={() => {
          if (preview) startCraft(preview.state);
          setPreview(null);
        }}
      />
    </div>
  );
}
