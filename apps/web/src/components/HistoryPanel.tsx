import { useState, type ReactNode } from 'react';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { CraftSession, SessionStep } from '@poe2-craft/craft-session';
import { formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { MANUAL_OPERATION_LABEL, SIDE_SHORT, manualEditText } from '@/lib/texts';
import { GameIcon } from './GameIcon';
import { Icon } from './Icon';
import { Panel } from './Panel';

interface HistoryPanelProps {
  readonly session: CraftSession;
  readonly view: CraftDbView;
  /** When each step was applied (recorded by the page, not by the session). */
  readonly timeOf: (step: SessionStep) => number | undefined;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onUndoTo: (index: number) => void;
}

type Filter = 'all' | 'applied' | 'undone';

const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Session history, newest first: applied steps, then undone ones (dimmed, redoable), then the
 * source. Craft steps and manual edits share one timeline; a manual edit is drawn apart (dashed,
 * pencil, no price) because it is not a game action.
 */
export function HistoryPanel(props: HistoryPanelProps) {
  const { session, view } = props;
  const [filter, setFilter] = useState<Filter>('all');
  const applied = [...session.steps].reverse();
  const undone = session.redoStack; // most recently undone last → the next redo is the last item
  const empty = session.steps.length === 0 && session.redoStack.length === 0;

  return (
    <Panel
      index={6}
      title="История крафта"
      className="panel-history"
      aside={
        <>
          <select name="history-filter" aria-label="Фильтр шагов" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">Все шаги</option>
            <option value="applied">Применённые</option>
            <option value="undone">Отменённые</option>
          </select>
          <button type="button" className="icon-btn" aria-label="Отменить (Ctrl+Z)" title="Отменить · Ctrl+Z" onClick={props.onUndo} disabled={session.steps.length === 0}>
            <Icon name="undo" size={15} />
          </button>
          <button type="button" className="icon-btn" aria-label="Повторить (Ctrl+Shift+Z)" title="Повторить · Ctrl+Shift+Z" onClick={props.onRedo} disabled={undone.length === 0}>
            <Icon name="redo" size={15} />
          </button>
        </>
      }
    >
      {empty ? (
        <p className="empty">Шагов нет. Возьмите валюту и кликните по текущему предмету.</p>
      ) : (
        <div className="table-scroll">
          <table className="table history-table">
            <thead>
              <tr>
                <th className="right">#</th>
                <th>Действие</th>
                <th>Результат</th>
                <th className="right">Цена</th>
                <th className="right hide-md">Время</th>
                <th aria-label="Откат" />
              </tr>
            </thead>
            <tbody>
              {filter !== 'applied' &&
                [...undone].reverse().map((step, i) => (
                  <StepRow
                    key={`redo-${step.index}`}
                    step={step}
                    view={view}
                    time={props.timeOf(step)}
                    state="undone"
                    action={
                      i === undone.length - 1 ? (
                        <button type="button" className="link-btn" onClick={props.onRedo}>
                          повторить
                        </button>
                      ) : null
                    }
                  />
                ))}
              {filter !== 'undone' &&
                applied.map((step, i) => (
                  <StepRow
                    key={step.index}
                    step={step}
                    view={view}
                    time={props.timeOf(step)}
                    state={i === 0 ? 'current' : 'applied'}
                    action={
                      i === 0 ? null : (
                        <button type="button" className="icon-btn icon-btn-quiet" aria-label={`Откатить к шагу ${step.index}`} title="Откатить сюда" onClick={() => props.onUndoTo(step.index)}>
                          <Icon name="undo" size={13} />
                        </button>
                      )
                    }
                  />
                ))}
              {filter !== 'undone' && (
                <tr className="history-origin">
                  <td className="num right">0</td>
                  <td colSpan={2}>Исходный предмет</td>
                  <td className="num right">—</td>
                  <td className="hide-md" />
                  <td className="right">
                    {session.steps.length > 0 && (
                      <button type="button" className="icon-btn icon-btn-quiet" aria-label="Откатить к исходному" title="Откатить к исходному" onClick={() => props.onUndoTo(0)}>
                        <Icon name="undo" size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function StepRow(props: {
  step: SessionStep;
  view: CraftDbView;
  time: number | undefined;
  state: 'current' | 'applied' | 'undone';
  action: ReactNode;
}) {
  const { step, view } = props;
  const tail = (
    <>
      <td className="num right hide-md muted">{props.time ? timeFormat.format(props.time) : '—'}</td>
      <td className="right">{props.state === 'undone' ? <span className="muted small">отменён </span> : null}{props.action}</td>
    </>
  );
  if (step.kind === 'manual-edit') {
    return (
      <tr className={`history-row history-${props.state} history-manual`}>
        <td className="num right">{step.index}</td>
        <td>
          <span className="history-action">
            <span className="history-icons history-manual-icon" aria-hidden>
              <Icon name="pencil" size={15} />
            </span>
            <span>
              Ручная правка <span className="muted small">· {MANUAL_OPERATION_LABEL[step.operation]}</span>
            </span>
          </span>
        </td>
        <td>
          <span className="history-result" title={step.label}>
            {step.from.side && <span className="side-mark-sm">{SIDE_SHORT[step.from.side]}</span>}
            <span className="mod-text">{manualEditText(step)}</span>
          </span>
        </td>
        <td className="num right muted" title="Ручная правка не тратит валюту">
          —
        </td>
        {tail}
      </tr>
    );
  }
  const consumables = step.cost.lines.map((l) => view.getConsumable(l.consumableId));
  return (
    <tr className={`history-row history-${props.state}`}>
      <td className="num right">{step.index}</td>
      <td>
        <span className="history-action">
          <span className="history-icons">
            {consumables.map((c, i) => (
              <GameIcon key={c?.id ?? i} src={consumableIconUrl(c)} label={c?.name ?? '?'} size={20} />
            ))}
          </span>
          <span>{consumables.map((c) => c?.name.replace(/^Omen of /, 'Omen: ') ?? '?').join(' + ') || step.actionName}</span>
        </span>
      </td>
      <td>
        <span className="history-result" title={`шанс этого мода был ${formatPercent(step.added.share)}`}>
          <span className="side-mark-sm">{SIDE_SHORT[step.added.side]}</span>
          <span className="mod-text">+ {step.added.text.replace(/\n/g, ' / ')}</span>
          <span className="tier-badge">T{step.added.tier}</span>
        </span>
      </td>
      <td className="num right">{formatCost(step.cost.total, step.cost.unit)}</td>
      {tail}
    </tr>
  );
}
