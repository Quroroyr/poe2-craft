import type { ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ModBadge, WorkspaceNotice } from '@/lib/session-ui';
import { GameIcon } from './GameIcon';
import { ItemCard } from './ItemCard';
import { Panel } from './Panel';

export interface ActiveToolView {
  readonly label: string;
  readonly icons: readonly { readonly src: string | null; readonly name: string }[];
  readonly costText: string;
  readonly chanceText: string | null;
}

interface CurrentItemPanelProps {
  readonly item: ItemState | null;
  readonly view: CraftDbView;
  readonly badges: ReadonlyMap<number, ModBadge>;
  readonly stepCount: number;
  readonly redoCount: number;
  /** null when no usable tool is selected. */
  readonly tool: ActiveToolView | null;
  /** Why a click would do nothing; null when it would apply. */
  readonly blockedReason: string | null;
  readonly notice: WorkspaceNotice | null;
  readonly sourceOutOfSync: boolean;
  readonly onCraft: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onReset: () => void;
}

/** The crafting canvas: hold a tool from the palette, click the item to use it. */
export function CurrentItemPanel(props: CurrentItemPanelProps) {
  const { item, tool, blockedReason } = props;
  const state = !item ? 'empty' : !tool ? 'idle' : blockedReason ? 'blocked' : 'ready';
  const hint =
    state === 'ready' && tool
      ? `Применить: ${tool.label} · ${tool.costText}`
      : state === 'blocked'
        ? `Нельзя: ${blockedReason}`
        : 'Выберите валюту в палитре ниже';

  return (
    <Panel
      title="Текущий предмет"
      step="2"
      aside={
        <span className="badge">{props.stepCount === 0 ? 'равен исходному' : `шагов: ${props.stepCount}`}</span>
      }
    >
      {props.sourceOutOfSync && (
        <div className="state-box state-warn banner-row">
          <span>Исходный предмет изменён после начала крафта. Текущий от него больше не происходит.</span>
          <button type="button" className="btn btn-small" onClick={props.onReset}>
            Reset craft
          </button>
        </div>
      )}

      <div className={`tool-status tool-status-${state}`}>
        {tool ? (
          <>
            <span className="tool-status-icons">
              {tool.icons.map((icon) => (
                <GameIcon key={icon.name} src={icon.src} label={icon.name} size={22} />
              ))}
            </span>
            <span>
              <b>{tool.label}</b>
              {state === 'ready' ? ' — кликните по предмету' : ''}
            </span>
          </>
        ) : (
          <span>Инструмент не выбран</span>
        )}
        {blockedReason && tool && <span className="tool-status-reason">{blockedReason}</span>}
      </div>

      {item ? (
        <div
          className={`craft-canvas craft-canvas-${state}`}
          role="button"
          tabIndex={0}
          aria-disabled={state !== 'ready'}
          aria-label={hint}
          title={hint}
          data-hint={hint}
          onClick={props.onCraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              props.onCraft();
            }
          }}
        >
          <ItemCard item={item} view={props.view} size="large" badges={props.badges} />
        </div>
      ) : (
        <p className="empty current-empty">Здесь появится текущий предмет — начните с исходного слева.</p>
      )}

      {props.notice && (
        <p className={`state-box ${props.notice.tone === 'ok' ? 'state-ok' : 'state-bad'} notice`} role="status">
          {props.notice.text}
        </p>
      )}

      <div className="secondary-actions">
        <button type="button" className="btn btn-small" onClick={props.onUndo} disabled={props.stepCount === 0}>
          ↶ Отменить <kbd>Ctrl+Z</kbd>
        </button>
        <button type="button" className="btn btn-small" onClick={props.onRedo} disabled={props.redoCount === 0}>
          ↷ Повторить <kbd>Ctrl+Shift+Z</kbd>
        </button>
        <button type="button" className="btn btn-small" onClick={props.onReset} disabled={props.stepCount === 0 && !props.sourceOutOfSync}>
          Reset craft
        </button>
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
