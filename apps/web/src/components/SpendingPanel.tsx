import { useState } from 'react';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { toolPalette, type SessionSpent, type SpentLine } from '@poe2-craft/craft-session';
import type { AttemptCost, StageCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import type { StageTargetOption } from '@/lib/analyze';
import { formatAttempts, formatCost, formatPercent, formatQuantile } from '@/lib/format';
import { consumableIconUrl, unitIconUrl } from '@/lib/icons';
import type { PriceInputs } from '@/lib/prices';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

interface SpendingPanelProps {
  readonly view: CraftDbView;
  readonly spent: SessionSpent;
  readonly spentLines: readonly SpentLine[];
  readonly attemptCost: AttemptCost | null;
  readonly stageCost: StageCost | null;
  readonly probability: ProbabilityResult | null;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTargetKey: string | null;
  readonly onStageTarget: (key: string) => void;
  readonly priceInputs: PriceInputs;
  readonly pricesAreMock: boolean;
  readonly onPrice: (consumableId: string, text: string) => void;
}

/**
 * Money already spent (fact, from recorded steps) kept apart from what the next click costs and
 * what the current stage is expected to cost (estimates).
 */
export function SpendingPanel(props: SpendingPanelProps) {
  const { view, spent, attemptCost, stageCost, probability } = props;
  const [tab, setTab] = useState<'costs' | 'prices'>('costs');
  const unit = attemptCost?.unit ?? spent.unit ?? 'div';
  const unitIcon = <GameIcon src={unitIconUrl(unit, view)} label={unit} size={16} />;

  return (
    <Panel index={7} title="Затраты и симуляция" className="panel-spending" aside={<span className="badge badge-warn">симуляция</span>}>
      <div className="segmented segmented-wide" role="tablist" aria-label="Затраты или цены">
        <button type="button" role="tab" aria-selected={tab === 'costs'} aria-pressed={tab === 'costs'} onClick={() => setTab('costs')}>
          Затраты
        </button>
        <button type="button" role="tab" aria-selected={tab === 'prices'} aria-pressed={tab === 'prices'} onClick={() => setTab('prices')}>
          Цены расходников{props.pricesAreMock ? ' (mock)' : ''}
        </button>
      </div>

      {tab === 'prices' ? (
        <PriceEditor view={view} priceInputs={props.priceInputs} onPrice={props.onPrice} />
      ) : (
        <>
          <h3 className="sub-head">Потрачено — факт</h3>
          {props.spentLines.length === 0 ? (
            <p className="empty small">Пока ничего: шаги крафта не записаны.</p>
          ) : (
            <table className="table compact spent-table">
              <thead>
                <tr>
                  <th>Расходник</th>
                  <th className="right">Кол-во</th>
                  <th className="right">Итого</th>
                </tr>
              </thead>
              <tbody>
                {props.spentLines.map((line) => {
                  const c = view.getConsumable(line.consumableId);
                  return (
                    <tr key={line.consumableId}>
                      <td>
                        <span className="unit">
                          <GameIcon src={consumableIconUrl(c)} label={c?.name ?? line.consumableId} size={18} />
                          {c?.name ?? line.consumableId}
                        </span>
                      </td>
                      <td className="num right">{line.quantity}</td>
                      <td className="num right">
                        {formatCost(line.total, spent.unit ?? unit)}
                        {line.unpriced && <span className="bad" title="Часть использований была без цены"> *</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="money-row">
            <div className="money money-fact">
              <span className="money-label">Потрачено всего</span>
              <span className="money-value num">
                {formatCost(spent.total, spent.unit ?? unit)} {unitIcon}
              </span>
              <span className="money-note">
                шагов: {spent.stepCount}
                {spent.incomplete && ' · не у всех была цена'}
              </span>
            </div>
            <div className="money money-est">
              <span className="money-label">Следующий клик</span>
              <span className="money-value num">{attemptCost ? formatCost(attemptCost.total, attemptCost.unit) : '—'}</span>
              <span className="money-note">оценка по текущим ценам</span>
            </div>
          </div>

          <h3 className="sub-head">Этап — оценка</h3>
          <label className="field">
            <span className="field-label">Цель шага</span>
            <select name="stage-target" value={props.stageTargetKey ?? ''} onChange={(e) => props.onStageTarget(e.target.value)}>
              {props.stageTargets.some((o) => o.origin === 'target-item') && (
                <optgroup label="Не хватает до цели">
                  {props.stageTargets
                    .filter((o) => o.origin === 'target-item')
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.target.label}
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Каталог (fixture)">
                {props.stageTargets
                  .filter((o) => o.origin === 'catalog')
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.target.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <dl className="stage-facts">
            <div>
              <dt>Шанс за попытку</dt>
              <dd className="num accent-blue">
                {probability?.status === 'ok'
                  ? formatPercent(probability.probability)
                  : probability?.status === 'already-satisfied'
                    ? 'уже есть'
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>Ожидаемо попыток</dt>
              <dd className="num">{probability?.status === 'ok' ? formatAttempts(probability.expectedAttempts) : '—'}</dd>
            </div>
            <div className="stage-cost">
              <dt>Ожидаемая стоимость</dt>
              <dd className="num accent">{stageCost ? `~ ${formatCost(stageCost.expectedCost, unit)}` : '—'}</dd>
            </div>
          </dl>
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
                Модель «кликать из текущего состояния до успеха»: оценка шага, а не всего маршрута.
              </p>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}

function PriceEditor(props: { view: CraftDbView; priceInputs: PriceInputs; onPrice: (id: string, text: string) => void }) {
  const { modelled } = toolPalette(props.view);
  const consumables = [...props.view.listConsumables()].sort((a, b) => Number(modelled.has(b.id)) - Number(modelled.has(a.id)));
  return (
    <div className="price-list">
      {consumables.map((c) => (
        <label key={c.id} className="price-row">
          <GameIcon src={consumableIconUrl(c)} label={c.name} size={22} />
          <span className="price-name">
            {c.name}
            {!modelled.has(c.id) && <span className="muted"> · не смоделирован</span>}
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
