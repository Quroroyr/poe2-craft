import type { ConsumableAmount } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { AttemptCost, PriceSource, StageCost } from '@poe2-craft/economy';
import { formatAttempts, formatCost, formatQuantile } from '@/lib/format';
import { consumableIconUrl, unitIconUrl } from '@/lib/icons';
import type { PriceInputs } from '@/lib/prices';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

interface EconomyPanelProps {
  readonly view: CraftDbView;
  readonly lines: readonly ConsumableAmount[];
  readonly onLines: (lines: readonly ConsumableAmount[]) => void;
  readonly priceInputs: PriceInputs;
  readonly onPrice: (consumableId: string, text: string) => void;
  readonly attemptCost: AttemptCost;
  readonly stageCost: StageCost | null;
  readonly priceSource: PriceSource;
}

export function EconomyPanel(props: EconomyPanelProps) {
  const { view, lines, onLines, attemptCost, stageCost } = props;
  const unit = attemptCost.unit;
  const unitIcon = unitIconUrl(unit, view);
  const consumables = view.listConsumables();
  const unused = consumables.filter((c) => !lines.some((l) => l.consumableId === c.id));

  const update = (index: number, patch: Partial<ConsumableAmount>) =>
    onLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const remove = (index: number) => onLines(lines.filter((_, i) => i !== index));
  const add = () => {
    const next = unused[0];
    if (next) onLines([...lines, { consumableId: next.id, quantity: 1 }]);
  };

  return (
    <Panel
      title="Экономика"
      step="5"
      aside={
        <span className={`badge ${props.priceSource === 'mock' ? 'badge-warn' : ''}`}>
          цены: {props.priceSource === 'mock' ? 'mock' : 'ручные'}
        </span>
      }
    >
      <table className="table cost-table">
        <thead>
          <tr>
            <th colSpan={2}>Расходник за попытку</th>
            <th className="right">Кол-во</th>
            <th className="right">
              <span className="unit">
                Цена, {unit} <GameIcon src={unitIcon} label={unit} size={18} />
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
                  <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label="Удалить строку">
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="text-btn" onClick={add} disabled={unused.length === 0}>
        + добавить расходник
      </button>

      {!attemptCost.complete && (
        <p className="state-box state-warn">
          Нет цены для: {attemptCost.missingPrices.map((id) => view.getConsumable(id)?.name ?? id).join(', ')}. Итог
          ниже её не учитывает.
        </p>
      )}

      <dl className="totals">
        <div>
          <dt>Стоимость попытки</dt>
          <dd className="num unit">
            {formatCost(attemptCost.total, unit)} <GameIcon src={unitIcon} label={unit} size={22} />
          </dd>
        </div>
        <div>
          <dt>Ожидаемая стоимость этапа</dt>
          <dd className="num strong unit">
            {stageCost ? formatCost(stageCost.expectedCost, unit) : '—'}
            {stageCost && <GameIcon src={unitIcon} label={unit} size={22} />}
          </dd>
        </div>
      </dl>
      {stageCost && (
        <>
          <p className="hint">
            Ожидаемая стоимость = цена попытки × {formatAttempts(stageCost.expectedAttempts)} попыток. Это среднее
            по многим крафтам; конкретному крафтеру может повезти или нет — смотрите разброс.
          </p>
          <table className="table compact">
            <caption>Разброс стоимости</caption>
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
        </>
      )}
    </Panel>
  );
}
