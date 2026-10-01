import { modifierText, type CraftTarget } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { EligiblePool, OutcomeShare, PoolEntry, ProbabilityResult } from '@poe2-craft/probability-engine';
import { formatInt, formatPercent } from '@/lib/format';
import { SIDE_SHORT, exclusionText } from '@/lib/texts';
import { Panel } from './Panel';

interface PoolTableProps {
  readonly pool: EligiblePool;
  readonly target: CraftTarget | null;
  readonly probability: ProbabilityResult | null;
  readonly view: CraftDbView;
}

export function PoolTable({ pool, target, probability, view }: PoolTableProps) {
  if (pool.status === 'blocked') {
    return (
      <Panel title="Пул модов" step="6">
        <p className="empty">Пул не построен — см. блок «Вероятность».</p>
      </Panel>
    );
  }

  const targetIds = new Set(target?.modifierIds ?? []);
  const shares = new Map<string, OutcomeShare>(
    probability?.status === 'ok' ? probability.outcomes.map((o) => [o.modifierId, o]) : [],
  );
  const excluded = pool.entries.filter((e) => !e.eligible);

  return (
    <Panel
      title="Пул модов"
      step="6"
      aside={
        <span className="muted small">
          {pool.eligible.length} доступно · {excluded.length} исключено · общий вес{' '}
          <b className="num">{formatInt(pool.totalKnownWeight)}</b>
        </span>
      }
    >
      <div className="table-scroll">
        <table className="table pool-table">
          <thead>
            <tr>
              <th>Сторона</th>
              <th>Мод</th>
              <th>Тир</th>
              <th className="right">ilvl</th>
              <th className="right">Вес</th>
              <th className="right">Доля пула</th>
            </tr>
          </thead>
          <tbody>
            {pool.eligible.map((entry) => (
              <PoolRow
                key={entry.definition.id}
                entry={entry}
                isTarget={targetIds.has(entry.definition.id)}
                share={shares.get(entry.definition.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <details className="excluded">
        <summary>Исключённые моды и причины ({excluded.length})</summary>
        <ul className="excluded-list">
          {excluded.map((entry) => (
            <li key={entry.definition.id} className={targetIds.has(entry.definition.id) ? 'is-target' : undefined}>
              <span className="side-pill">{SIDE_SHORT[entry.definition.side]}</span>
              <span className="excluded-mod">
                {modifierText(entry.definition)} <span className="muted">T{entry.definition.tier}</span>
              </span>
              <span className="excluded-why">{entry.reasons.map((r) => exclusionText(r, view)).join('; ')}</span>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

function PoolRow({ entry, isTarget, share }: { entry: PoolEntry; isTarget: boolean; share: OutcomeShare | undefined }) {
  const d = entry.definition;
  return (
    <tr className={isTarget ? 'is-target' : undefined}>
      <td>
        <span className="side-pill">{SIDE_SHORT[d.side]}</span>
      </td>
      <td>
        <span className="pool-mod">{modifierText(d)}</span>
        <span className="pool-name">
          «{d.name}»{isTarget && <span className="tag tag-target">цель</span>}
        </span>
      </td>
      <td className="num">T{d.tier}</td>
      <td className="num right">{d.requiredItemLevel}</td>
      <td className="num right">{entry.weight === null ? <span className="bad">неизвестен</span> : formatInt(entry.weight)}</td>
      <td className="num right">{share ? formatPercent(share.probability) : '—'}</td>
    </tr>
  );
}
