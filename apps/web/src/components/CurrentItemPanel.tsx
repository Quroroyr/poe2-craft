import type { ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { AttemptCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { formatAttempts, formatCost, formatPercent } from '@/lib/format';
import type { ModBadge, WorkspaceNotice } from '@/lib/session-ui';
import { ItemCard } from './ItemCard';
import { Panel } from './Panel';

interface CurrentItemPanelProps {
  readonly item: ItemState | null;
  readonly view: CraftDbView;
  readonly badges: ReadonlyMap<number, ModBadge>;
  readonly stepCount: number;
  readonly actionName: string | null;
  readonly stageTargetLabel: string | null;
  readonly probability: ProbabilityResult | null;
  readonly attemptCost: AttemptCost;
  readonly notice: WorkspaceNotice | null;
  readonly sourceChanged: boolean;
  readonly onApply: () => void;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
}

/** The centre of the workspace: the item being crafted and the controls that change it. */
export function CurrentItemPanel(props: CurrentItemPanelProps) {
  const { item, probability } = props;
  return (
    <Panel
      title="Текущий предмет"
      step="2"
      aside={
        <span className="badge">
          {props.stepCount === 0 ? 'равен исходному' : `шагов: ${props.stepCount}`}
        </span>
      }
    >
      {props.sourceChanged && (
        <div className="state-box state-warn banner-row">
          <span>Исходный предмет изменён, а сессия начата с прежнего.</span>
          <button type="button" className="btn btn-small" onClick={props.onRestart}>
            Начать заново с нового
          </button>
        </div>
      )}

      {item ? (
        <ItemCard item={item} view={props.view} size="large" badges={props.badges} />
      ) : (
        <p className="empty current-empty">Вставьте исходный предмет слева — с него начнётся крафт.</p>
      )}

      <div className="action-bar">
        <div className="action-summary">
          <div>
            <span className="muted">Действие:</span> {props.actionName ?? '—'}
          </div>
          <div>
            <span className="muted">Цель шага:</span> {props.stageTargetLabel ?? '—'}
          </div>
          <div className="num">
            <span className="muted">Шанс цели за клик:</span>{' '}
            {probability?.status === 'ok' ? (
              <>
                <b className="accent">{formatPercent(probability.probability)}</b> · ≈{' '}
                {formatAttempts(probability.expectedAttempts)} попыток
              </>
            ) : probability?.status === 'already-satisfied' ? (
              'цель уже на предмете'
            ) : (
              'недоступно'
            )}
            <span className="muted"> · попытка {formatCost(props.attemptCost.total, props.attemptCost.unit)}</span>
          </div>
        </div>
        <div className="action-buttons">
          <button type="button" className="btn btn-primary" onClick={props.onApply} disabled={!item}>
            Применить
          </button>
          <button type="button" className="btn" onClick={props.onUndo} disabled={props.stepCount === 0}>
            Отменить шаг
          </button>
          <button type="button" className="btn" onClick={props.onRestart} disabled={props.stepCount === 0}>
            К исходному
          </button>
        </div>
      </div>
      <p className="hint">
        Применение — <b>демо-симуляция</b>: мод выбирается по весам fixture-пула, значения — равномерно в
        диапазоне тира. Это не воспроизведение реальной механики PoE 2.
      </p>
      {props.notice && (
        <p className={`state-box ${props.notice.tone === 'ok' ? 'state-ok' : 'state-bad'} notice`} role="status">
          {props.notice.text}
        </p>
      )}

      {item && (
        <details className="debug">
          <summary>Debug: ItemState текущего предмета</summary>
          <pre>{JSON.stringify(item, null, 2)}</pre>
        </details>
      )}
    </Panel>
  );
}
