import type { CraftDbView } from '@poe2-craft/craft-db';
import type { CraftStepRecord } from '@poe2-craft/craft-session';
import { formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { SIDE_LABEL } from '@/lib/texts';
import { GameIcon } from './GameIcon';
import { Panel } from './Panel';

interface HistoryPanelProps {
  readonly steps: readonly CraftStepRecord[];
  readonly view: CraftDbView;
}

export function HistoryPanel({ steps, view }: HistoryPanelProps) {
  return (
    <Panel title="История сессии" step="6" aside={<span className="badge badge-warn">симуляция</span>}>
      {steps.length === 0 ? (
        <p className="empty">Шагов пока нет. Выберите способ крафта и нажмите «Применить».</p>
      ) : (
        <ol className="history" reversed>
          {[...steps].reverse().map((step) => (
            <li key={step.index} className="history-step">
              <div className="history-head">
                <span className="history-index">Шаг {step.index}</span>
                <span className="history-icons">
                  {step.cost.lines.map((line) => {
                    const consumable = view.getConsumable(line.consumableId);
                    return (
                      <GameIcon
                        key={line.consumableId}
                        src={consumableIconUrl(consumable)}
                        label={consumable?.name ?? line.consumableId}
                        size={22}
                      />
                    );
                  })}
                </span>
                <span className="history-action">{step.actionName}</span>
                <span className="num history-cost">{formatCost(step.cost.total, step.cost.unit)}</span>
              </div>
              <div className="history-result">
                <span className="mod-text">{step.added.text}</span>
                <span className="mod-meta">
                  {SIDE_LABEL[step.added.side]} «{step.added.name}» T{step.added.tier} · шанс этого мода{' '}
                  {formatPercent(step.added.share)}
                </span>
              </div>
              <div className="history-after muted">
                После шага: {step.after.explicits.length} мод(ов) на предмете
                {!step.cost.complete && ' · у части расходников не было цены'}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
