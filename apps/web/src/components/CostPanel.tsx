import type { ConsumableAmount } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { SessionSpent } from '@poe2-craft/craft-session';
import type { AttemptCost, PriceSource, StageCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { formatAttempts, formatCost, formatPercent, formatQuantile } from '@/lib/format';
import { consumableIconUrl, unitIconUrl } from '@/lib/icons';
import type { PriceInputs } from '@/lib/prices';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

interface CostPanelProps {
  readonly view: CraftDbView;
  readonly spent: SessionSpent;
  readonly probability: ProbabilityResult | null;
  readonly lines: readonly ConsumableAmount[];
  readonly onLines: (lines: readonly ConsumableAmount[]) => void;
  readonly priceInputs: PriceInputs;
  readonly onPrice: (consumableId: string, text: string) => void;
  readonly attemptCost: AttemptCost;
  readonly stageCost: StageCost | null;
  readonly priceSource: PriceSource;
}

export function CostPanel(props: CostPanelProps) {
  const { view, spent, attemptCost, stageCost, probability } = props;
  const unit = attemptCost.unit;
  const unitIcon = unitIconUrl(unit, view);
  const money = (value: number, u: string = unit) => (
    <span className="unit">
      {formatCost(value, u)} <GameIcon src={unitIconUrl(u, view)} label={u} size={20} />
    </span>
  );

  return (
    <Panel
      title="Затраты"
      step="5"
      aside={
        <span className={`badge ${props.priceSource === 'mock' ? 'badge-warn' : ''}`}>
          цены: {props.priceSource === 'mock' ? 'mock' : 'ручные'}
        </span>
      }
    >
      <div className="cost-split">
        <div className="cost-fact">
          <span className="kpi-label">Уже потрачено в сессии</span>
          <span className="kpi-value">{spent.unit ? money(spent.total, spent.unit) : money(0)}</span>
          <span className="kpi-note">
            факт: {spent.stepCount} {plural(spent.stepCount, 'шаг', 'шага', 'шагов')}
            {spent.incomplete && ' · не у всех расходников была цена'}
            {spent.mixedUnits && ' · шаги в разных единицах, учтена только первая'}
          </span>
        </div>
        <div className="cost-estimates">
          <div className="kpi">
            <span className="kpi-label">Цена одной попытки</span>
            <span className="kpi-value small">{money(attemptCost.total)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Шанс за попытку</span>
            <span className="kpi-value small">
              {probability?.status === 'ok' ? formatPercent(probability.probability) : '—'}
            </span>
            <span className="kpi-note">
              {probability?.status === 'ok' ? `≈ ${formatAttempts(probability.expectedAttempts)} попыток` : ''}
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Ожидаемая стоимость этапа</span>
            <span className="kpi-value small accent">{stageCost ? money(stageCost.expectedCost) : '—'}</span>
            <span className="kpi-note">оценка, не факт</span>
          </div>
        </div>
      </div>
      <p className="hint">
        «Ожидаемая стоимость этапа» считается от текущего предмета в модели «повторять попытку из этого же
        состояния до успеха». Из-за отсутствия памяти у такой модели ожидаемый остаток после неудачи такой же — уже
        потраченное его не уменьшает. Реальный предмет после неудачной попытки меняется, поэтому это оценка
        шага, а не всего маршрута.
      </p>

      {stageCost && (
        <table className="table compact">
          <caption>Разброс стоимости этапа</caption>
          <thead>
            <tr>
              <th>Доля крафтеров</th>
              <th className="right">Попыток</th>
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
      )}

      <details className="cost-editor" open>
        <summary>Расходники одной попытки и цены</summary>
        <ConsumableTable {...props} unitIcon={unitIcon} />
      </details>
    </Panel>
  );
}

function ConsumableTable(props: CostPanelProps & { unitIcon: string | null }) {
  const { view, lines, onLines, attemptCost } = props;
  const unit = attemptCost.unit;
  const consumables = view.listConsumables();
  const unused = consumables.filter((c) => !lines.some((l) => l.consumableId === c.id));
  const update = (index: number, patch: Partial<ConsumableAmount>) =>
    onLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const add = () => {
    const next = unused[0];
    if (next) onLines([...lines, { consumableId: next.id, quantity: 1 }]);
  };

  return (
    <>
      <div className="table-scroll">
        <table className="table cost-table">
          <thead>
            <tr>
              <th colSpan={2}>Расходник</th>
              <th className="right">Кол-во</th>
              <th className="right">
                <span className="unit">
                  Цена, {unit} <GameIcon src={props.unitIcon} label={unit} size={18} />
                </span>
              </th>
              <th className="right">Итого</th>
              <th aria-label="Удалить" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const costLine = attemptCost.lines[i];
              const consumable = view.getConsumable(line.consumableId);
              return (
                <tr key={`${line.consumableId}-${i}`}>
                  <td className="icon-cell">
                    <GameIcon src={consumableIconUrl(consumable)} label={consumable?.name ?? line.consumableId} />
                  </td>
                  <td>
                    <select
                      name={`consumable-${i}`}
                      aria-label="Расходник"
                      value={line.consumableId}
                      onChange={(e) => update(i, { consumableId: e.target.value })}
                    >
                      {consumables
                        .filter((c) => c.id === line.consumableId || unused.includes(c))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="right">
                    <input
                      name={`quantity-${i}`}
                      aria-label="Количество"
                      className="num-input qty"
                      type="number"
                      min={0}
                      step={1}
                      value={line.quantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        update(i, { quantity: Number.isFinite(q) && q >= 0 ? q : 0 });
                      }}
                    />
                  </td>
                  <td className="right">
                    <input
                      name={`price-${line.consumableId}`}
                      aria-label={`Цена в ${unit}`}
                      className={`num-input${costLine?.unitPrice === null ? ' invalid' : ''}`}
                      inputMode="decimal"
                      value={props.priceInputs[line.consumableId] ?? ''}
                      placeholder="цена"
                      onChange={(e) => props.onPrice(line.consumableId, e.target.value)}
                    />
                  </td>
                  <td className="num right">
                    {costLine?.subtotal == null ? '—' : formatCost(costLine.subtotal, unit)}
                  </td>
                  <td className="right">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onLines(lines.filter((_, j) => j !== i))}
                      aria-label="Удалить строку"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="text-btn" onClick={add} disabled={unused.length === 0}>
        + добавить расходник
      </button>
      {!attemptCost.complete && (
        <p className="state-box state-warn">
          Нет цены для: {attemptCost.missingPrices.map((id) => view.getConsumable(id)?.name ?? id).join(', ')}.
          Итог её не учитывает.
        </p>
      )}
    </>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
