import { useState } from 'react';
import { modifierText, type CraftTarget } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ExplorerGroup, ExplorerRow, ExplorerTabId, PoolExplorer } from '@poe2-craft/probability-engine';
import { formatInt, formatPercent } from '@/lib/format';
import { EXPLORER_STATUS_LABEL, exclusionText } from '@/lib/texts';
import { Panel } from './Panel';

const TAB_LABEL: Record<ExplorerTabId, string> = { prefix: 'Префиксы', suffix: 'Суффиксы' };

interface PoolExplorerPanelProps {
  readonly explorer: PoolExplorer | null;
  readonly target: CraftTarget | null;
  readonly view: CraftDbView;
}

export function PoolExplorerPanel({ explorer, target, view }: PoolExplorerPanelProps) {
  const [tabId, setTabId] = useState<ExplorerTabId>('suffix');
  const [onlyEligible, setOnlyEligible] = useState(false);

  if (!explorer) {
    return (
      <Panel title="Пул модов" step="8">
        <p className="empty">Пул не построен: нет текущего предмета или действие к нему не применимо.</p>
      </Panel>
    );
  }

  const tab = explorer.tabs.find((t) => t.id === tabId) ?? explorer.tabs[0];
  const targetIds = new Set(target?.modifierIds ?? []);
  const groups = (tab?.groups ?? []).filter((g) => !onlyEligible || g.status === 'eligible');

  return (
    <Panel
      title="Пул модов"
      step="8"
      aside={
        <span className="muted small">
          общий вес доступных <b className="num">{formatInt(explorer.totalWeight)}</b>
        </span>
      }
    >
      <div className="tabs-row">
        <div className="tabs" role="tablist" aria-label="Тип модов">
          {explorer.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab?.id}
              className={`tab${t.id === tab?.id ? ' tab-active' : ''}`}
              onClick={() => setTabId(t.id)}
            >
              {TAB_LABEL[t.id]}
              <span className="tab-meta num">
                {t.counts.eligible} · {t.share === null ? '0 %' : formatPercent(t.share)}
              </span>
            </button>
          ))}
          <span className="tab tab-disabled" title="Появится вместе с механикой Desecration">
            Desecrated <span className="tab-meta">скоро</span>
          </span>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyEligible} onChange={(e) => setOnlyEligible(e.target.checked)} />
          только доступные
        </label>
      </div>

      {tab && (
        <p className="status-legend small">
          {(['eligible', 'already-present', 'blocked', 'excluded'] as const).map((s) => (
            <span key={s} className={`status status-${s}`}>
              {EXPLORER_STATUS_LABEL[s]}: {tab.counts[s]}
            </span>
          ))}
        </p>
      )}

      <div className="table-scroll">
        <table className="table explorer-table">
          <thead>
            <tr>
              <th>Мод</th>
              <th>Тир</th>
              <th className="right hide-sm">ilvl</th>
              <th className="right hide-sm">Ур. мода</th>
              <th className="right">Вес</th>
              <th className="right">Доля</th>
              <th>Статус</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <GroupRows
              key={group.key}
              group={group}
              view={view}
              targetIds={targetIds}
              onlyEligible={onlyEligible}
            />
          ))}
        </table>
      </div>
      {explorer.hiddenNotSpawnable > 0 && (
        <p className="hint">
          Скрыто {explorer.hiddenNotSpawnable} мод(ов), которые на эту базу не выпадают вообще (другие классы
          предметов).
        </p>
      )}
    </Panel>
  );
}

function GroupRows(props: {
  group: ExplorerGroup;
  view: CraftDbView;
  targetIds: ReadonlySet<string>;
  onlyEligible: boolean;
}) {
  const { group } = props;
  const rows = group.rows.filter((r) => !props.onlyEligible || r.status === 'eligible');
  return (
    <tbody className={`explorer-group row-${group.status}`}>
      <tr className="group-row">
        <th colSpan={4} scope="rowgroup" className="group-label">
          {group.label}
        </th>
        <td className="num right">{group.eligibleWeight > 0 ? formatInt(group.eligibleWeight) : '—'}</td>
        <td className="num right">{group.share === null ? '—' : formatPercent(group.share)}</td>
        <td>
          <span className={`status status-${group.status}`}>{EXPLORER_STATUS_LABEL[group.status]}</span>
        </td>
      </tr>
      {rows.map((row) => (
        <TierRow key={row.entry.definition.id} row={row} view={props.view} isTarget={props.targetIds.has(row.entry.definition.id)} />
      ))}
    </tbody>
  );
}

function TierRow({ row, view, isTarget }: { row: ExplorerRow; view: CraftDbView; isTarget: boolean }) {
  const d = row.entry.definition;
  return (
    <tr className={`tier-row row-${row.status}${isTarget ? ' is-target' : ''}`}>
      <td>
        <span className="pool-mod">{modifierText(d)}</span>
        <span className="pool-name">
          «{d.name}»{isTarget && <span className="tag tag-target">цель</span>}
        </span>
        {row.status !== 'eligible' && (
          <span className="pool-reason">{row.entry.reasons.map((r) => exclusionText(r, view)).join('; ')}</span>
        )}
      </td>
      <td className="num">T{d.tier}</td>
      <td className="num right hide-sm">{d.requiredItemLevel}</td>
      <td className="num right hide-sm">{d.modifierLevel}</td>
      <td className="num right">
        {row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight)}
      </td>
      <td className="num right">{row.share === null ? '—' : formatPercent(row.share)}</td>
      <td>
        <span className={`status status-${row.status}`}>{EXPLORER_STATUS_LABEL[row.status]}</span>
      </td>
    </tr>
  );
}
