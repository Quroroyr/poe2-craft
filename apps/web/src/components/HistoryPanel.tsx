import { useState, type ReactNode } from 'react';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { CraftSession, SessionStep } from '@poe2-craft/craft-session';
import { formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { SIDE_SHORT, manualEditText, manualOperationLabel } from '@/lib/texts';
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

/**
 * Session history, newest first: applied steps, then undone ones (dimmed, redoable), then the
 * source. Craft steps and manual edits share one timeline; a manual edit is drawn apart (dashed,
 * pencil, no price) because it is not a game action.
 */
export function HistoryPanel(props: HistoryPanelProps) {
  const { session, view } = props;
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const applied = [...session.steps].reverse();
  const undone = session.redoStack; // most recently undone last → the next redo is the last item
  const empty = session.steps.length === 0 && session.redoStack.length === 0;

  return (
    <Panel
      index={5}
      title={t('history.title')}
      className="panel-history"
      aside={
        <>
          <select name="history-filter" aria-label={t('history.filter')} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">{t('history.all')}</option>
            <option value="applied">{t('history.applied')}</option>
            <option value="undone">{t('history.undone')}</option>
          </select>
          <button type="button" className="icon-btn" aria-label={t('action.undo')} title={t('action.undoTitle')} onClick={props.onUndo} disabled={session.steps.length === 0}>
            <Icon name="undo" size={15} />
          </button>
          <button type="button" className="icon-btn" aria-label={t('action.redo')} title={t('action.redoTitle')} onClick={props.onRedo} disabled={undone.length === 0}>
            <Icon name="redo" size={15} />
          </button>
        </>
      }
    >
      {empty ? (
        <p className="empty">{t('history.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table history-table">
            <thead>
              <tr>
                <th className="right">#</th>
                <th>{t('history.col.action')}</th>
                <th>{t('history.col.result')}</th>
                <th className="right">{t('history.col.cost')}</th>
                <th className="right hide-md">{t('history.col.time')}</th>
                <th aria-label={t('history.col.rollback')} />
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
                          {t('history.redo')}
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
                        <button type="button" className="icon-btn icon-btn-quiet" aria-label={t('history.rollbackTo', { index: step.index })} title={t('history.rollbackHere')} onClick={() => props.onUndoTo(step.index)}>
                          <Icon name="undo" size={13} />
                        </button>
                      )
                    }
                  />
                ))}
              {filter !== 'undone' && (
                <tr className="history-origin">
                  <td className="num right">0</td>
                  <td colSpan={2}>{t('history.origin')}</td>
                  <td className="num right">—</td>
                  <td className="hide-md" />
                  <td className="right">
                    {session.steps.length > 0 && (
                      <button type="button" className="icon-btn icon-btn-quiet" aria-label={t('history.rollbackOrigin')} title={t('history.rollbackOrigin')} onClick={() => props.onUndoTo(0)}>
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
  const { t, fmt } = useI18n();
  const tail = (
    <>
      <td className="num right hide-md muted">{props.time ? fmt.time(props.time) : '—'}</td>
      <td className="right">{props.state === 'undone' ? <span className="muted small">{t('history.undoneMark')} </span> : null}{props.action}</td>
    </>
  );
  if (step.kind === 'manual-edit') {
    // An added modifier has no "before": its side is the new one's.
    const side = (step.from ?? step.to)?.side ?? null;
    return (
      <tr className={`history-row history-${props.state} history-manual`}>
        <td className="num right">{step.index}</td>
        <td>
          <span className="history-action">
            <span className="history-icons history-manual-icon" aria-hidden>
              <Icon name="pencil" size={15} />
            </span>
            <span>
              {t('history.manual')} <span className="muted small">· {manualOperationLabel(t, step.operation)}</span>
            </span>
          </span>
        </td>
        <td>
          <span className="history-result" title={step.label}>
            {side && <span className="side-mark-sm">{SIDE_SHORT[side]}</span>}
            <span className="mod-text">{manualEditText(step)}</span>
          </span>
        </td>
        <td className="num right muted" title={t('history.manualNoCost')}>
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
        {step.added ? <span className="history-result" title={t('history.chance', { chance: formatPercent(step.added.share) })}>
          <span className="side-mark-sm">{SIDE_SHORT[step.added.side]}</span>
          <span className="mod-text">+ {step.added.text.replace(/\n/g, ' / ')}</span>
          <span className="tier-badge">T{step.added.tier}</span>
        </span> : <span>{(step.changes ?? []).map((change) => t(`operation.${change.kind}` as import('@/i18n/core').MessageKey)).join(' · ')}</span>}
      </td>
      <td className="num right">{formatCost(step.cost.total, step.cost.unit)}</td>
      {tail}
    </tr>
  );
}
