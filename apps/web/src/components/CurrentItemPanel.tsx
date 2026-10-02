import { useRef, useState, type PointerEvent } from 'react';
import type { AffixSide, ExplicitModifier, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { HeldTool } from '@/lib/held-tool';
import type { ModBadge, WorkspaceNotice } from '@/lib/session-ui';
import { RARITY_LABEL, SIDE_LABEL, SIDE_SHORT, SLOT_LABEL, UNRESOLVED_LABEL } from '@/lib/texts';
import { HeldToolCursor } from './HeldToolCursor';
import { Icon } from './Icon';
import { ArtFrame, BaseStats } from './ItemBits';
import { ModMoreButton } from './ModMoreButton';
import { Panel } from './Panel';

/** Result of the last click on the item, for the short visual response. `id` grows with every click. */
export interface CraftFeedback {
  readonly id: number;
  readonly tone: 'ok' | 'bad';
}

interface CurrentItemPanelProps {
  readonly item: ItemState | null;
  readonly view: CraftDbView;
  readonly badges: ReadonlyMap<number, ModBadge>;
  readonly stepCount: number;
  readonly redoCount: number;
  /** null when nothing is held. */
  readonly tool: HeldTool | null;
  readonly feedback: CraftFeedback | null;
  /** Index of the modifier added by the last successful click. */
  readonly freshIndex: number | null;
  readonly notice: WorkspaceNotice | null;
  readonly sourceOutOfSync: boolean;
  readonly canReset: boolean;
  readonly onCraft: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onReset: () => void;
  /** Opens the modifier context menu at a viewport point (right click or the "…" button). */
  readonly onModMenu: (index: number, x: number, y: number) => void;
  /** Index of the modifier whose menu is open, to keep it highlighted. */
  readonly menuIndex: number | null;
}

/** The crafting object: hold a tool from the strip below, click the item to use it. */
export function CurrentItemPanel(props: CurrentItemPanelProps) {
  const { item, tool, feedback, view } = props;
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const impactRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const state = !item ? 'empty' : !tool ? 'idle' : tool.state;
  const label =
    state === 'ready' && tool
      ? `Применить ${tool.icons.map((i) => i.name).join(' + ')} к предмету`
      : state === 'blocked'
        ? `Нельзя применить: ${tool?.reason ?? ''}`
        : 'Возьмите валюту в полосе инструментов';

  // The overlay follows the pointer by direct style writes: no React render per mouse move.
  // The orb itself is centred on that point by CSS (.held-stack).
  const placeCursor = () => {
    const el = cursorRef.current;
    const { x, y } = pointerRef.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const moveCursor = (e: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    placeCursor();
  };
  const attachCursor = (el: HTMLDivElement | null) => {
    cursorRef.current = el;
    placeCursor();
  };

  const base = item?.baseId ? view.getBase(item.baseId) : undefined;
  const limits = item?.rarity ? view.getAffixLimits(item.rarity) : undefined;
  const sideOf = (m: ExplicitModifier): AffixSide | null =>
    m.kind === 'resolved' ? (view.getModifier(m.modifierId)?.side ?? null) : null;
  const count = (side: AffixSide) => item?.explicits.filter((m) => sideOf(m) === side).length ?? 0;
  // Prefixes first, then suffixes, then lines we could not place — the order the game shows.
  const ordered = item
    ? (['prefix', 'suffix', null] as const).flatMap((side) =>
        item.explicits.map((mod, index) => ({ mod, index })).filter(({ mod }) => sideOf(mod) === side),
      )
    : [];

  return (
    <Panel
      index={2}
      title="Текущий предмет"
      variant="ornate"
      className="panel-current"
      aside={
        <>
          <button type="button" className="icon-btn" aria-label="Отменить (Ctrl+Z)" title="Отменить · Ctrl+Z" onClick={props.onUndo} disabled={props.stepCount === 0}>
            <Icon name="undo" size={15} />
          </button>
          <button type="button" className="icon-btn" aria-label="Повторить (Ctrl+Shift+Z)" title="Повторить · Ctrl+Shift+Z" onClick={props.onRedo} disabled={props.redoCount === 0}>
            <Icon name="redo" size={15} />
          </button>
          <button type="button" className="btn btn-small" onClick={props.onReset} disabled={!props.canReset}>
            <Icon name="reset" size={14} />
            Сбросить
          </button>
        </>
      }
    >
      {props.sourceOutOfSync && (
        <div className="state-box state-warn banner-row" role="status">
          <span>Исходный предмет изменён после начала крафта — текущий от него больше не происходит.</span>
          <button type="button" className="btn btn-small" onClick={props.onReset}>
            Reset craft
          </button>
        </div>
      )}

      {item ? (
        <div
          className={`craft-zone craft-zone-${state}${hovering && tool ? ' craft-zone-holding' : ''}`}
          role="button"
          tabIndex={0}
          aria-disabled={state !== 'ready'}
          aria-label={label}
          onPointerEnter={(e) => {
            if (e.pointerType === 'touch') return;
            setHovering(true);
            moveCursor(e);
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== 'touch') moveCursor(e);
          }}
          onPointerLeave={() => setHovering(false)}
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            // Keyboard activation reports (0, 0): put the impact in the middle of the item.
            impactRef.current =
              e.clientX === 0 && e.clientY === 0
                ? { x: box.width / 2, y: box.height / 2 }
                : { x: e.clientX - box.left, y: e.clientY - box.top };
            props.onCraft();
          }}
          onKeyDown={(e) => {
            // Keys on the modifiers' own buttons ("…") belong to them, not to the craft click.
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <div
            key={feedback?.id ?? 0}
            className={`craft-card rarity-${item.rarity ?? 'unknown'}${feedback ? (feedback.tone === 'ok' ? ' craft-hit' : ' craft-deny') : ''}`}
          >
            <div className="current-top">
              <ArtFrame base={base} label={item.baseName ?? 'предмет'} glow="gold" maxHeight={188} className="current-art" />
              <div className="current-info">
                <h3 className="item-name">{item.baseName ?? 'База не распознана'}</h3>
                <p className="item-sub">
                  <span className="rarity-text">{item.rarity ? `${RARITY_LABEL[item.rarity]} предмет` : 'Редкость ?'}</span> · ilvl{' '}
                  {item.itemLevel ?? '?'}
                </p>
                <dl className="current-meta">
                  {item.quality !== null && (
                    <div>
                      <dt>Качество:</dt>
                      <dd className="num aug">+{item.quality}%</dd>
                    </div>
                  )}
                  {item.slots.map((slot) => (
                    <div key={slot.kind}>
                      <dt>{SLOT_LABEL[slot.kind] ?? slot.kind}:</dt>
                      <dd className="num">{slot.count}</dd>
                    </div>
                  ))}
                </dl>
                <BaseStats base={base} />
              </div>
            </div>

            <ul className="current-mods">
              {ordered.length === 0 && <li className="current-mods-empty">Модов нет — кликните валютой, чтобы добавить.</li>}
              {ordered.map(({ mod, index }) => (
                <CurrentMod
                  key={index}
                  mod={mod}
                  view={view}
                  badge={props.badges.get(index)}
                  fresh={props.freshIndex === index}
                  menuOpen={props.menuIndex === index}
                  onMenu={(x, y) => props.onModMenu(index, x, y)}
                />
              ))}
            </ul>

            <footer className="current-foot num">
              <span>
                Префиксы <b>{count('prefix')} / {limits?.maxPrefixes ?? '?'}</b>
              </span>
              <span>
                Суффиксы <b>{count('suffix')} / {limits?.maxSuffixes ?? '?'}</b>
              </span>
              <span className="current-foot-ilvl">ilvl: {item.itemLevel ?? '?'}</span>
            </footer>
          </div>
          {feedback?.tone === 'ok' && (
            <span
              key={`impact-${feedback.id}`}
              className="craft-impact"
              style={{ left: impactRef.current.x, top: impactRef.current.y }}
              aria-hidden
            />
          )}
          {hovering && tool && <HeldToolCursor ref={attachCursor} tool={tool} pulseKey={feedback?.id ?? 0} />}
        </div>
      ) : (
        <p className="empty current-empty">Здесь появится текущий предмет — соберите или импортируйте исходный.</p>
      )}

      {props.notice && (
        <p className={`notice notice-${props.notice.tone}`} role="status">
          {props.notice.text}
        </p>
      )}
      <p className="hint current-hint">
        Клик по предмету — <b>демо-симуляция</b>: мод выбирается по весам демо-пула, значения — равномерно в диапазоне
        тира.
      </p>
    </Panel>
  );
}

function CurrentMod(props: {
  mod: ExplicitModifier;
  view: CraftDbView;
  badge: ModBadge | undefined;
  fresh: boolean;
  menuOpen: boolean;
  onMenu: (x: number, y: number) => void;
}) {
  const { mod, badge } = props;
  const def = mod.kind === 'resolved' ? props.view.getModifier(mod.modifierId) : undefined;
  const classes = [
    'current-mod',
    mod.fractured && 'is-fractured',
    mod.kind === 'unresolved' && 'is-unresolved',
    badge?.tone === 'new' && 'is-new',
    props.fresh && 'is-fresh',
    props.menuOpen && 'is-menu-open',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <li
      className={classes}
      onContextMenu={(e) => {
        // A right click on a modifier opens its menu, never the browser's and never a craft click.
        e.preventDefault();
        e.stopPropagation();
        props.onMenu(e.clientX, e.clientY);
      }}
    >
      <span className={`side-mark side-${def?.side ?? 'unknown'}`} title={def ? SIDE_LABEL[def.side] : 'сторона неизвестна'}>
        {def ? SIDE_SHORT[def.side] : '?'}
      </span>
      <span className="mod-body">
        <span className="mod-text">{mod.sourceText.replace(/\s*\(fractured\)$/i, '')}</span>
        <span className="mod-tags">
          {def && <span className="tag tag-name">{def.name.replace(/^of /, '')}</span>}
          {mod.fractured && (
            <span className="tag tag-fractured">
              <Icon name="crack" size={11} />
              fractured
            </span>
          )}
          {mod.kind === 'unresolved' && <span className="tag tag-bad">{UNRESOLVED_LABEL[mod.reason]}</span>}
          {badge && <span className={`tag tag-${badge.tone}`}>{badge.label}</span>}
        </span>
      </span>
      <span className="tier-badge">{def ? `T${def.tier}` : '—'}</span>
      <ModMoreButton label="Действия с модом" open={props.menuOpen} onMenu={props.onMenu} />
    </li>
  );
}

