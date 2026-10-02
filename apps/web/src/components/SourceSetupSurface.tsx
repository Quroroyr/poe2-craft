import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemBaseId, ItemState, ModifierDefinition } from '@poe2-craft/craft-domain';
import { EMPTY_TOOL, applySourcePick, createItemFromBase, createSession } from '@poe2-craft/craft-session';
import { useI18n } from '@/i18n/I18nProvider';
import type { CraftDb } from '@poe2-craft/craft-db';
import { analyzeWorkspace, type ExplorerMode } from '@/lib/analyze';
import { buildModMenu, type MenuIntent } from '@/lib/mod-menu';
import { BaseSelector } from './BaseSelector';
import { ContextMenu } from './ContextMenu';
import { ModifierPoolPanel } from './ModifierPoolPanel';
import { SourcePanel } from './SourcePanel';

const INSPECT: ExplorerMode = { kind: 'inspect' };
const DEFAULT_ITEM_LEVEL = 82;
const NO_HIGHLIGHT: ReadonlySet<string> = new Set();

interface SourceSetupSurfaceProps {
  readonly db: CraftDb;
  /** create: a new item from a base; edit: the starting item of the active craft. */
  readonly purpose: 'create' | 'edit';
  readonly initial: ItemState | null;
  readonly gameVersion: string;
  readonly craftStarted: boolean;
  readonly onConfirm: (source: ItemState) => void;
  readonly onCancel: () => void;
}

/**
 * Setting up the starting item, on its own surface instead of a permanent column. It reuses the
 * existing pieces — SourcePanel, BaseSelector, the modifier pool picker and the source context
 * menu — on a draft, so nothing reaches the session until Create / Save.
 */
export function SourceSetupSurface(props: SourceSetupSurfaceProps) {
  const { t } = useI18n();
  const craftDb = props.db;
  const [draft, setDraft] = useState<ItemState | null>(props.initial);
  const [mode, setMode] = useState<ExplorerMode>(INSPECT);
  const [catalogOpen, setCatalogOpen] = useState(props.initial === null);
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null);

  // The draft is analysed as if it were a session's source: same setup rules, same pool, same picks.
  const draftSession = useMemo(
    () => createSession({ gameVersion: props.gameVersion, seed: 0, source: draft }),
    [draft, props.gameVersion],
  );
  const analysis = useMemo(
    () => analyzeWorkspace({ session: draftSession, tool: EMPTY_TOOL, stageTargetKey: null, explorerMode: mode }, craftDb),
    [draftSession, mode, craftDb],
  );
  const { view } = analysis;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode(INSPECT);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const chooseBase = (baseId: ItemBaseId) => {
    const next = createItemFromBase(view, baseId, draft?.itemLevel ?? DEFAULT_ITEM_LEVEL);
    if (!next) return;
    setDraft(next);
    setCatalogOpen(false);
    setMode(INSPECT);
  };
  const pick = (definition: ModifierDefinition) => {
    const option = analysis.picks?.get(definition.id);
    if (draft && option?.allowed) setDraft(applySourcePick(draft, option));
  };
  const runIntent = (intent: MenuIntent) => {
    if (intent.kind === 'source') setDraft(intent.source);
    else if (intent.kind === 'explore') setMode(intent.mode);
  };
  const closeMenu = useCallback(() => setMenu(null), []);
  const menuModel = menu
    ? buildModMenu({ scope: 'source', index: menu.index }, { t, session: draftSession, db: craftDb, view, poolAvailable: false })
    : null;

  return (
    <section className="setup-surface" aria-labelledby="setup-title">
      <header className="setup-head">
        <h2 id="setup-title">{t(props.purpose === 'create' ? 'setup.createTitle' : 'setup.editTitle')}</h2>
        <p>{t(props.purpose === 'create' ? 'setup.createLead' : 'setup.editLead')}</p>
      </header>

      <div className="setup-grid">
        <SourcePanel
          source={draft}
          view={view}
          setup={analysis.sourceSetup}
          explorerMode={mode}
          craftStarted={props.craftStarted}
          onEdit={setDraft}
          onExplore={setMode}
          onChooseBase={chooseBase}
          onOpenCatalog={() => setCatalogOpen(true)}
          onClear={() => {
            if (draft?.baseId) chooseBase(draft.baseId);
          }}
          onModMenu={(index, x, y) => setMenu({ index, x, y })}
          menuIndex={menu?.index ?? null}
        />
        <div className="setup-pool">
          {mode.kind === 'inspect' ? (
            <p className="hint setup-pool-hint">{t('setup.poolHint')}</p>
          ) : (
            <ModifierPoolPanel
              key={`${mode.kind}-${'side' in mode ? mode.side : ''}-${'replaceIndex' in mode ? mode.replaceIndex : ''}`}
              explorer={analysis.explorer}
              mode={mode}
              view={view}
              highlightIds={NO_HIGHLIGHT}
              picks={analysis.picks}
              focus={null}
              toolLabel={null}
              onPick={pick}
              onExit={() => setMode(INSPECT)}
            />
          )}
        </div>
      </div>

      <footer className="setup-actions">
        <button type="button" className="btn" onClick={props.onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-primary" disabled={!draft} onClick={() => draft && props.onConfirm(draft)}>
          {t(props.purpose === 'create' ? 'setup.create' : 'setup.save')}
        </button>
      </footer>

      <BaseSelector
        open={catalogOpen}
        view={view}
        currentBaseId={draft?.baseId ?? null}
        dropsModifiers={(draft?.explicits.length ?? 0) > 0}
        onSelect={chooseBase}
        onClose={() => setCatalogOpen(false)}
      />
      {menu && menuModel && <ContextMenu model={menuModel} x={menu.x} y={menu.y} onIntent={runIntent} onClose={closeMenu} />}
    </section>
  );
}
