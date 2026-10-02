import type { CraftDbView } from '@poe2-craft/craft-db';
import { toolPalette, type CraftSession, type CraftStepRecord, type SessionSpent } from '@poe2-craft/craft-session';
import type { AttemptCost, StageCost } from '@poe2-craft/economy';
import { formatAttempts, formatCost, formatPercent, formatQuantile } from '@/lib/format';
import { consumableIconUrl, unitIconUrl } from '@/lib/icons';
import type { PriceInputs } from '@/lib/prices';
import { SIDE_LABEL } from '@/lib/texts';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

interface SessionPanelProps {
  readonly session: CraftSession;
  readonly view: CraftDbView;
  readonly spent: SessionSpent;
  readonly attemptCost: AttemptCost | null;
  readonly stageCost: StageCost | null;
  readonly priceInputs: PriceInputs;
  readonly pricesAreMock: boolean;
  readonly onPrice: (consumableId: string, text: string) => void;
  readonly onUndoTo: (index: number) => void;
  readonly onRedo: () => void;
}

/** Money already spent (fact) next to what the next click costs and what the stage may cost (estimates). */
export function SessionPanel(props: SessionPanelProps) {
  const { session, view, spent, attemptCost, stageCost } = props;
  const unit = attemptCost?.unit ?? spent.unit ?? 'div';
  const money = (value: number) => (
    <span className="unit">
      {formatCost(value, unit)} <GameIcon src={unitIconUrl(unit, view)} label={unit} size={18} />
    </span>
  );

  return (
    <Panel title="История и затраты" aside={<span className="badge badge-warn">симуляция</span>}>
      <div className="spend">
        <div className="cost-fact">
          <span className="kpi-label">Потрачено (факт)</span>
          <span className="kpi-value">{money(spent.total)}</span>
          <span className="kpi-note">
            шагов: {spent.stepCount}
            {spent.incomplete && ' · не у всех расходников была цена'}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Следующий клик</span>
          <span className="kpi-value small">{attemptCost ? money(attemptCost.total) : '—'}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Ожидаемо до цели шага</span>
          <span className="kpi-value small accent">{stageCost ? money(stageCost.expectedCost) : '—'}</span>
          <span className="kpi-note">
            {stageCost ? `оценка · ≈${formatAttempts(stageCost.expectedAttempts)} кликов` : 'нет шанса или инструмента'}
          </span>
        </div>
      </div>

      {stageCost && (
        <details className="quantiles">
          <summary>Разброс стоимости этапа</summary>
          <table className="table compact">
            <thead>
              <tr>
                <th>Доля крафтеров</th>
                <th className="right">Кликов</th>
                <th className="right">Потратят не больше</th>
              </tr>
            </thead>
            <tbody>
              {stageCost.quantiles.map((q) => (
                <tr key={q.quantile}>
                  <td className="num">{formatQuantile(q.quantile)}</td>
                  <td className="num right">{formatAttempts(q.attempts)}</td>
                  <td className="num right">{formatCost(q.cost, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Оценка в модели «кликать из текущего состояния до успеха». Реальный предмет после неудачного клика
            меняется, поэтому это оценка шага, а не всего маршрута.
          </p>
        </details>
      )}

      <h3 className="sub-head">История</h3>
      {session.steps.length === 0 && session.redoStack.length === 0 ? (
        <p className="empty">Шагов нет. Выберите сферу и кликните по текущему предмету.</p>
      ) : (
        <ol className="history">
          <li className="history-step history-origin">
            <span className="history-index">0</span> Исходный предмет
            {session.steps.length > 0 && (
              <button type="button" className="link-btn" onClick={() => props.onUndoTo(0)}>
                откатить сюда
              </button>
            )}
          </li>
          {session.steps.map((step) => (
            <StepRow
              key={step.index}
              step={step}
              view={view}
              current={step.index === session.steps.length}
              onUndoTo={() => props.onUndoTo(step.index)}
            />
          ))}
          {[...session.redoStack].reverse().map((step, i) => (
            <StepRow
              key={`redo-${step.index}`}
              step={step}
              view={view}
              undone
              onRedo={i === 0 ? props.onRedo : undefined}
            />
          ))}
        </ol>
      )}

      <details className="cost-editor">
        <summary>Цены расходников{props.pricesAreMock ? ' (mock)' : ''}</summary>
        <PriceEditor view={view} priceInputs={props.priceInputs} onPrice={props.onPrice} />
      </details>
    </Panel>
  );
}

function StepRow(props: {
  step: CraftStepRecord;
  view: CraftDbView;
  current?: boolean;
  undone?: boolean;
  onUndoTo?: () => void;
  onRedo?: (() => void) | undefined;
}) {
  const { step, view } = props;
  return (
    <li className={`history-step${props.undone ? ' history-undone' : ''}${props.current ? ' history-current' : ''}`}>
      <div className="history-head">
        <span className="history-index">{step.index}</span>
        <span className="history-icons">
          {step.cost.lines.map((line) => {
            const c = view.getConsumable(line.consumableId);
            return <GameIcon key={line.consumableId} src={consumableIconUrl(c)} label={c?.name ?? line.consumableId} size={20} />;
          })}
        </span>
        <span className="history-action">{step.cost.lines.map((l) => view.getConsumable(l.consumableId)?.name ?? l.consumableId).join(' + ') || step.actionName}</span>
        <span className="num history-cost">{formatCost(step.cost.total, step.cost.unit)}</span>
      </div>
      <div className="history-result">
        <span className="mod-text">→ {step.added.text.replace(/\n/g, ' / ')}</span>
        <span className="mod-meta">
          {SIDE_LABEL[step.added.side]} T{step.added.tier} · шанс {formatPercent(step.added.share)}
        </span>
      </div>
      {props.undone ? (
        <div className="history-after">
          отменён{props.onRedo && (
            <>
              {' · '}
              <button type="button" className="link-btn" onClick={props.onRedo}>
                повторить
              </button>
            </>
          )}
        </div>
      ) : (
        !props.current &&
        props.onUndoTo && (
          <button type="button" className="link-btn" onClick={props.onUndoTo}>
            откатить сюда
          </button>
        )
      )}
    </li>
  );
}

function PriceEditor(props: { view: CraftDbView; priceInputs: PriceInputs; onPrice: (id: string, text: string) => void }) {
  const palette = toolPalette(props.view);
  const tools = new Set(Object.values(palette.byCategory).flat().map((c) => c.id));
  const consumables = [...props.view.listConsumables()].sort((a, b) => Number(tools.has(b.id)) - Number(tools.has(a.id)));
  return (
    <div className="price-list">
      {consumables.map((c) => (
        <label key={c.id} className="price-row">
          <GameIcon src={consumableIconUrl(c)} label={c.name} size={22} />
          <span className="price-name">
            {c.name}
            {!tools.has(c.id) && <span className="muted"> · не инструмент</span>}
          </span>
          <input
            name={`price-${c.id}`}
            className="num-input"
            inputMode="decimal"
            value={props.priceInputs[c.id] ?? ''}
            placeholder="цена"
            onChange={(e) => props.onPrice(c.id, e.target.value)}
          />
          <span className="muted small">div</span>
        </label>
      ))}
    </div>
  );
}
