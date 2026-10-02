import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { formatAttempts, formatInt, formatPercent, formatQuantile } from '@/lib/format';
import { exclusionText, issueText } from '@/lib/texts';
import { Panel } from './Panel';

interface ProbabilityPanelProps {
  readonly result: ProbabilityResult | null;
  readonly view: CraftDbView;
}

export function ProbabilityPanel({ result, view }: ProbabilityPanelProps) {
  return (
    <Panel title="Вероятность цели шага">
      <ProbabilityBody result={result} view={view} />
    </Panel>
  );
}

function ProbabilityBody({ result, view }: ProbabilityPanelProps) {
  if (!result) return <p className="empty">Выберите цель.</p>;

  switch (result.status) {
    case 'blocked':
      return (
        <div className="state-box state-bad">
          <p>Расчёт невозможен:</p>
          <ul>
            {result.issues.map((issue, i) => (
              <li key={i}>{issueText(issue)}</li>
            ))}
          </ul>
        </div>
      );
    case 'already-satisfied':
      return (
        <div className="state-box state-ok">
          Цель уже есть на предмете ({result.modifierIds.map((id) => view.getModifier(id)?.name ?? id).join(', ')}).
        </div>
      );
    case 'indeterminate':
      return (
        <div className="state-box state-warn">
          Вес цели неизвестен ({result.modifierIds.join(', ')}). Шанс не считаем: неизвестный вес нельзя
          подставлять как достоверный.
        </div>
      );
    case 'target-unavailable':
      return (
        <div className="state-box state-bad">
          <p>Цель недоступна для этого действия на этом предмете:</p>
          <ul>
            {result.targetEntries.map((e) => (
              <li key={e.definition.id}>
                <b>
                  {e.definition.name} (T{e.definition.tier})
                </b>
                : {e.reasons.map((r) => exclusionText(r, view)).join('; ')}
              </li>
            ))}
            {result.missingModifierIds.map((id) => (
              <li key={id}>{id}: нет в выбранной версии игры</li>
            ))}
          </ul>
        </div>
      );
    case 'ok':
      return (
        <>
          <div className="headline">
            <div className="headline-main">
              <span className="headline-label">Шанс за попытку</span>
              <span className="headline-value">
                {result.bound === 'upper-bound' && '≤ '}
                {formatPercent(result.probability)}
              </span>
            </div>
            <div className="headline-side">
              <span className="headline-label">Ожидаемо попыток</span>
              <span className="headline-value small">{formatAttempts(result.expectedAttempts)}</span>
            </div>
          </div>
          <p className="formula">
            P = вес цели / вес пула = <b className="num">{formatInt(result.targetWeight)}</b> /{' '}
            <b className="num">{formatInt(result.totalWeight)}</b>
          </p>

          <div className="two-tables">
            <table className="table compact">
              <caption>Шанс успеть за N попыток</caption>
              <thead>
                <tr>
                  <th>N</th>
                  <th className="right">1 − (1 − P)ᴺ</th>
                </tr>
              </thead>
              <tbody>
                {result.cumulative.map((c) => (
                  <tr key={c.attempts}>
                    <td className="num">{c.attempts}</td>
                    <td className="num right">{formatPercent(c.probability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="table compact">
              <caption>Сколько попыток хватит</caption>
              <thead>
                <tr>
                  <th>Доля крафтеров</th>
                  <th className="right">Попыток</th>
                </tr>
              </thead>
              <tbody>
                {result.quantiles.map((q) => (
                  <tr key={q.quantile}>
                    <td className="num">{formatQuantile(q.quantile)}</td>
                    <td className="num right">≤ {formatAttempts(q.attempts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
  }
}
