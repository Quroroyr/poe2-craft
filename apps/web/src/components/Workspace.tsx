'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addRequirement, type ItemState, type ModifierDefinition, type TargetSpec } from '@poe2-craft/craft-domain';
import {
  EMPTY_TOOL,
  addSourceModifier,
  applyStep,
  createSession,
  isSourceOutOfSync,
  redoStep,
  replaceSourceModifier,
  resetToSource,
  selectCurrency,
  sessionSpent,
  setSource,
  targetForSource,
  undoLastStep,
  undoToStep,
  withTarget,
  type CraftSession,
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
import { formatAttempts, formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { INITIAL_PRICE_INPUTS, snapshotFromInputs, type PriceInputs } from '@/lib/prices';
import { applyNotice, currentItemBadges, randomSeed, type WorkspaceNotice } from '@/lib/session-ui';
import { applyRejectionText } from '@/lib/texts';
import { CurrentItemPanel, type ActiveToolView } from './CurrentItemPanel';
import { DataPanel } from './DataPanel';
import { ExplanationPanel } from './ExplanationPanel';
import { ModifierPoolPanel } from './ModifierPoolPanel';
import { ProbabilityPanel } from './ProbabilityPanel';
import { SessionPanel } from './SessionPanel';
import { SourcePanel } from './SourcePanel';
import { TargetPanel } from './TargetPanel';
import { ToolPalette } from './ToolPalette';

const INSPECT: ExplorerMode = { kind: 'inspect' };

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
  const explorerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        setSession(undoLastStep);
        setNotice(null);
      } else if ((e.ctrlKey || e.metaKey) && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault();
        setSession(redoStep);
        setNotice(null);
      } else if (key === 'escape') {
        setExplorerMode(INSPECT);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const craft = () => {
    if (analysis.tool.status === 'none') {
      setNotice({ tone: 'bad', text: 'Сначала выберите валюту в палитре инструментов.' });
      return;
    }
    if (analysis.tool.status === 'unsupported' || !action || !attemptCost) {
      setNotice({ tone: 'bad', text: 'Эта комбинация инструментов не смоделирована — предмет не изменён.' });
      return;
    }
    if (analysis.blockedBy) {
      setNotice({ tone: 'bad', text: `Предмет не изменён. ${applyRejectionText(analysis.blockedBy)}` });
      return;
    }
    const result = applyStep(session, { db: craftDb, actionId: action.id, cost: attemptCost });
    setSession(result.session);
    setNotice(applyNotice(result, view));
  };

  const explore = (mode: ExplorerMode) => {
    setExplorerMode(mode);
    requestAnimationFrame(() => explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const editSource = (source: ItemState | null) => setSession((s) => setSource(s, source));
  const editTarget = (target: TargetSpec | null) => setSession((s) => withTarget(s, target));

  const pick = (definition: ModifierDefinition) => {
    if (explorerMode.kind === 'edit-source' && session.source) {
      const source = session.source;
      if (explorerMode.replaceIndex !== undefined) {
        editSource(replaceSourceModifier(source, explorerMode.replaceIndex, definition));
        setExplorerMode(INSPECT);
      } else {
        editSource(addSourceModifier(source, definition));
      }
    } else if (explorerMode.kind === 'edit-target') {
      editTarget(addRequirement(session.target ?? targetForSource(session.source), definition.id));
    }
  };

  const changeVersion = (gameVersion: string) => {
    // Items refer to modifiers by stable id, so source and target survive; the crafted history does not.
    setSession((s) => createSession({ gameVersion, seed: s.seed, source: s.source, target: s.target }));
    setNotice(null);
  };

  const toolView: ActiveToolView | null =
    analysis.tool.status === 'none'
      ? null
      : {
          label: analysis.tool.consumables.map((c) => c.name).join(' + '),
          icons: analysis.tool.consumables.map((c) => ({ src: consumableIconUrl(c), name: c.name })),
          costText: attemptCost ? formatCost(attemptCost.total, attemptCost.unit) : 'нет модели',
          chanceText:
            probability?.status === 'ok'
              ? `${formatPercent(probability.probability)} · ≈${formatAttempts(probability.expectedAttempts)}`
              : null,
        };
  const blockedReason =
    analysis.tool.status === 'unsupported'
      ? 'эта комбинация не смоделирована'
      : analysis.blockedBy
        ? applyRejectionText(analysis.blockedBy)
        : null;

  return (
    <div className="page">
      <header className="masthead">
        <div>
          <h1>PoE 2 Craft Planner</h1>
          <p className="masthead-sub">Исходный → текущий → цель. Выберите инструмент и кликайте по текущему предмету.</p>
        </div>
        {view.info.kind === 'fixture' && (
          <p className="fixture-banner" role="note">
            <strong>Демо-данные и демо-симуляция.</strong> Тиры, уровни и веса модов придуманы для проверки движка;
            клик по предмету разыгрывает упрощённую модель, а не механику PoE 2.
          </p>
        )}
      </header>

      <main className="layout">
        <section className="workspace" aria-label="Рабочий стол">
          <div className="ws-source">
            <SourcePanel
              source={session.source}
              view={view}
              explorerMode={explorerMode}
              onImport={(text) => editSource(importSource(text, session.gameVersion))}
              onEdit={editSource}
              onExplore={explore}
            />
          </div>
          <div className="ws-current">
            <CurrentItemPanel
              item={session.current}
              view={view}
              badges={currentItemBadges(session, comparison)}
              stepCount={session.steps.length}
              redoCount={session.redoStack.length}
              tool={toolView}
              blockedReason={blockedReason}
              notice={notice}
              sourceOutOfSync={isSourceOutOfSync(session)}
              onCraft={craft}
              onUndo={() => {
                setSession(undoLastStep);
                setNotice(null);
              }}
              onRedo={() => setSession(redoStep)}
              onReset={() => {
                setSession(resetToSource);
                setNotice(null);
              }}
            />
          </div>
          <div className="ws-target">
            <TargetPanel
              target={session.target}
              comparison={comparison}
              view={view}
              explorerMode={explorerMode}
              onImport={(text) => editTarget(importTarget(text, session.gameVersion))}
              onEdit={editTarget}
              onCreate={() => editTarget(targetForSource(session.source))}
              onExplore={explore}
            />
          </div>
        </section>

        <ToolPalette
          db={craftDb}
          view={view}
          selection={tool}
          onSelect={setTool}
          resolved={analysis.tool}
          priceInputs={priceInputs}
          attemptCost={attemptCost}
          probability={probability}
          stageTargets={analysis.stageTargets}
          stageTargetKey={analysis.stageTarget?.key ?? null}
          onStageTarget={setStageTargetKey}
          gameVersion={session.gameVersion}
          onGameVersion={changeVersion}
        />

        <div className="row-pool">
          <div ref={explorerRef} className={explorerMode.kind === 'inspect' ? undefined : 'explorer-editing'}>
            <ModifierPoolPanel
              key={explorerMode.kind === 'inspect' ? 'inspect' : `${explorerMode.kind}-${explorerMode.side}-${'replaceIndex' in explorerMode ? explorerMode.replaceIndex : ''}`}
              explorer={analysis.explorer}
              mode={explorerMode}
              view={view}
              highlightIds={new Set(analysis.stageTarget?.target.modifierIds ?? [])}
              toolLabel={toolView?.label ?? null}
              onPick={pick}
              onExit={() => setExplorerMode(INSPECT)}
            />
          </div>
          <SessionPanel
            session={session}
            view={view}
            spent={spent}
            attemptCost={attemptCost}
            stageCost={stageCost}
            priceInputs={priceInputs}
            pricesAreMock={!pricesEdited}
            onPrice={(id, text) => {
              setPriceInputs((prev) => ({ ...prev, [id]: text }));
              setPricesEdited(true);
            }}
            onUndoTo={(index) => {
              setSession((s) => undoToStep(s, index));
              setNotice(null);
            }}
            onRedo={() => setSession(redoStep)}
          />
        </div>

        <div className="row-2">
          <ProbabilityPanel result={probability} view={view} />
          <ExplanationPanel steps={analysis.explanation} view={view} />
        </div>
        <DataPanel view={view} probability={probability} />
      </main>
    </div>
  );
}
