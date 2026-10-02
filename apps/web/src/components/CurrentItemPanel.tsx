import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { HeldTool } from '@/lib/held-tool';
import type { ModBadge, WorkspaceNotice } from '@/lib/session-ui';
import { HeldToolCursor } from './HeldToolCursor';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';
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
  /** Tool palette and active craft, rendered above the item. */
  readonly toolbar: ReactNode;
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
}

/** The crafting object: hold a tool from the palette, click the item to use it. */
export function CurrentItemPanel(props: CurrentItemPanelProps) {
  const { item, tool, feedback } = props;
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
        : 'Выберите валюту в палитре выше';

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

  return (
    <Panel
      title="Текущий предмет"
      className="panel-current"
      aside={
        <span className="badge">
          {props.stepCount === 0 && !props.sourceOutOfSync ? 'равен исходному' : `шагов: ${props.stepCount}`}
        </span>
      }
    >
      {props.toolbar}

      {props.sourceOutOfSync && (
        <div className="state-box state-warn banner-row" role="status">
          <span>Исходный предмет изменён после начала крафта — текущий от него больше не происходит.</span>
          <button type="button" className="btn btn-small" onClick={props.onReset}>
            <Icon name="reset" size={14} />
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
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}
        >
          <div
            key={feedback?.id ?? 0}
            className={`craft-card${feedback ? (feedback.tone === 'ok' ? ' craft-hit' : ' craft-deny') : ''}`}
          >
            <ItemCard item={item} view={props.view} variant="hero" badges={props.badges} freshIndex={props.freshIndex} />
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

      <div className="craft-footer">
        <div className="secondary-actions">
          <button type="button" className="btn btn-small" onClick={props.onUndo} disabled={props.stepCount === 0}>
            <Icon name="undo" size={14} />
            Отменить <kbd>Ctrl+Z</kbd>
          </button>
          <button type="button" className="btn btn-small" onClick={props.onRedo} disabled={props.redoCount === 0}>
            <Icon name="redo" size={14} />
            Повторить <kbd>Ctrl+Shift+Z</kbd>
          </button>
          <button type="button" className="btn btn-small" onClick={props.onReset} disabled={!props.canReset}>
            <Icon name="reset" size={14} />
            Reset craft
          </button>
        </div>
        {props.notice && (
          <p className={`notice notice-${props.notice.tone}`} role="status">
            {props.notice.text}
          </p>
        )}
      </div>
      <p className="hint">
        Клик по предмету — <b>демо-симуляция</b>: мод выбирается по весам fixture-пула, значения — равномерно в
        диапазоне тира. Это не воспроизведение механики PoE 2.
      </p>

      {item && (
        <details className="debug">
          <summary>Debug: ItemState текущего предмета</summary>
          <pre>{JSON.stringify(item, null, 2)}</pre>
        </details>
      )}
    </Panel>
  );
}
