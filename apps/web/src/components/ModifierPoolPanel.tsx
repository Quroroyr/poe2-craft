import { useMemo, useState } from 'react';
import { modifierText, type ModifierDefinition } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type {
  ExplorerGroup,
  ExplorerRow,
  ExplorerStatus,
  ExplorerTabId,
  PoolExplorer,
} from '@poe2-craft/probability-engine';
import type { ExplorerMode } from '@/lib/analyze';
import { formatInt, formatPercent } from '@/lib/format';
import { EXPLORER_STATUS_LABEL, exclusionText } from '@/lib/texts';
import { Icon } from './Icon';
import { Panel } from './Panel';

const TAB_LABEL: Record<ExplorerTabId, string> = { prefix: 'Префиксы', suffix: 'Суффиксы' };
const FUTURE_TABS = ['Implicits', 'Desecrated', 'Special'];

interface ModifierPoolPanelProps {
  readonly explorer: PoolExplorer | null;
  readonly mode: ExplorerMode;
  readonly view: CraftDbView;
  /** Modifier ids of the current stage target, highlighted in inspect mode. */
  readonly highlightIds: ReadonlySet<string>;
  readonly toolLabel: string | null;
  readonly onPick: (definition: ModifierDefinition) => void;
  readonly onExit: () => void;
}

/**
 * One explorer for every job: inspect the current item's pool for the active tool, pick a
 * modifier for the source, or pick a requirement for the target. The engine decides statuses;
 * this component only filters and displays them.
 */
export function ModifierPoolPanel(props: ModifierPoolPanelProps) {
  const { explorer, mode, view } = props;
  const editing = mode.kind !== 'inspect';
  const [tabId, setTabId] = useState<ExplorerTabId>(mode.kind === 'inspect' ? 'suffix' : mode.side);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExplorerStatus | 'all'>(editing ? 'eligible' : 'all');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const tab = explorer?.tabs.find((t) => t.id === tabId) ?? explorer?.tabs[0];
  const groups = useMemo(() => filterGroups(tab?.groups ?? [], query, statusFilter), [tab, query, statusFilter]);
  const searching = query.trim().length > 0;
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Panel
      title="Пул модов"
      aside={<ModeChip mode={mode} toolLabel={props.toolLabel} onExit={props.onExit} />}
    >
      {!explorer || !tab ? (
        <p className="empty">
          {mode.kind === 'inspect'
            ? 'Выберите инструмент в палитре — здесь появится пул, из которого он добавляет моды.'
            : 'Пул не построен: нет предмета или база не найдена в CraftDB.'}
        </p>
      ) : (
        <>
          <div className="tabs-row">
            <div className="tabs" role="tablist" aria-label="Тип модов">
              {explorer.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === tab.id}
                  className={`tab${t.id === tab.id ? ' tab-active' : ''}`}
                  onClick={() => setTabId(t.id)}
                >
                  {TAB_LABEL[t.id]}
                  <span className="tab-meta num">
                    {t.counts.eligible} доступно
                    {mode.kind === 'inspect' && t.share !== null && ` · ${formatPercent(t.share)}`}
                  </span>
                </button>
              ))}
              {FUTURE_TABS.map((name) => (
                <span key={name} className="tab tab-disabled" title="Появится вместе с механикой">
                  {name}
                  <span className="tab-meta">скоро</span>
                </span>
              ))}
            </div>
          </div>

          <div className="pool-filters">
            <input
              type="search"
              name="pool-search"
              className="search-input"
              placeholder="Поиск: текст, имя, тег…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              name="pool-status"
              aria-label="Статус"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ExplorerStatus | 'all')}
            >
              <option value="all">Все статусы</option>
              {(['eligible', 'already-present', 'blocked', 'excluded'] as const).map((s) => (
                <option key={s} value={s}>
                  {EXPLORER_STATUS_LABEL[s]} ({tab.counts[s]})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="link-btn"
              onClick={() => setExpanded(expanded.size > 0 ? new Set() : new Set(groups.map((g) => g.key)))}
            >
              {expanded.size > 0 ? 'свернуть все' : 'развернуть все'}
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="empty">Ничего не найдено.</p>
          ) : (
            <ul className="families">
              {groups.map((group) => (
                <Family
                  key={group.key}
                  group={group}
                  open={searching || expanded.has(group.key)}
                  onToggle={() => toggle(group.key)}
                  mode={mode}
                  view={view}
                  highlightIds={props.highlightIds}
                  onPick={props.onPick}
                />
              ))}
            </ul>
          )}
          {explorer.hiddenNotSpawnable > 0 && (
            <p className="hint">Скрыто {explorer.hiddenNotSpawnable} мод(ов) других классов предметов.</p>
          )}
        </>
      )}
    </Panel>
  );
}

function ModeChip({ mode, toolLabel, onExit }: { mode: ExplorerMode; toolLabel: string | null; onExit: () => void }) {
  if (mode.kind === 'inspect') {
    return <span className="mode-chip">осмотр текущего{toolLabel ? ` · ${toolLabel}` : ''}</span>;
  }
  const label =
    mode.kind === 'edit-target'
      ? 'добавление требования в цель'
      : mode.replaceIndex !== undefined
        ? 'замена мода исходного'
        : 'добавление в исходный';
  return (
    <span className="mode-chip mode-chip-edit">
      {label}
      <button type="button" className="icon-btn" aria-label="Вернуться к осмотру" onClick={onExit}>
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

function Family(props: {
  group: ExplorerGroup;
  open: boolean;
  onToggle: () => void;
  mode: ExplorerMode;
  view: CraftDbView;
  highlightIds: ReadonlySet<string>;
  onPick: (definition: ModifierDefinition) => void;
}) {
  const { group, mode } = props;
  const tags = [...new Set(group.rows.flatMap((r) => r.entry.definition.tags))];
  const best = group.rows.reduce<ExplorerRow | null>(
    (acc, r) => (!acc || r.entry.definition.tier < acc.entry.definition.tier ? r : acc),
    null,
  );
  const hasTarget = group.rows.some((r) => props.highlightIds.has(r.entry.definition.id));
  return (
    <li className={`family family-${group.status}${hasTarget && mode.kind === 'inspect' ? ' is-target' : ''}`}>
      <button type="button" className="family-head" aria-expanded={props.open} onClick={props.onToggle}>
        <Icon name="chevron" size={14} className={`family-caret${props.open ? ' rot-90' : ''}`} />
        <span className="family-name">
          {best ? best.entry.definition.lines.map((l) => l.template).join(' / ') : group.label}
          <span className="family-label">{group.label}</span>
        </span>
        <span className="family-tags">
          {tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </span>
        <span className="family-weight num">
          {mode.kind === 'inspect' && group.share !== null ? formatPercent(group.share) : `${group.rows.length} тир.`}
        </span>
        <span className={`status status-${group.status}`}>{EXPLORER_STATUS_LABEL[group.status]}</span>
      </button>
      {props.open && (
        <div className="table-scroll">
          <table className="table tier-table">
            <thead>
              <tr>
                <th>Тир</th>
                <th>Мод</th>
                <th className="right">ilvl</th>
                <th className="right hide-sm">Ур. мода</th>
                <th className="right">Вес</th>
                {mode.kind === 'inspect' && <th className="right">Доля</th>}
                <th>Статус</th>
                {mode.kind !== 'inspect' && <th aria-label="Выбор" />}
              </tr>
            </thead>
            <tbody>
              {[...group.rows]
                .sort((a, b) => a.entry.definition.tier - b.entry.definition.tier)
                .map((row) => (
                  <TierRow
                    key={row.entry.definition.id}
                    row={row}
                    mode={mode}
                    view={props.view}
                    isTarget={props.highlightIds.has(row.entry.definition.id)}
                    onPick={props.onPick}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

function TierRow(props: {
  row: ExplorerRow;
  mode: ExplorerMode;
  view: CraftDbView;
  isTarget: boolean;
  onPick: (definition: ModifierDefinition) => void;
}) {
  const { row, mode } = props;
  const d = row.entry.definition;
  return (
    <tr className={`tier-row row-${row.status}${props.isTarget ? ' is-target' : ''}`}>
      <td className="num">T{d.tier}</td>
      <td>
        <span className="pool-mod">{modifierText(d)}</span>
        <span className="pool-name">
          {d.name}
          {props.isTarget && mode.kind === 'inspect' && <span className="tag tag-target">цель</span>}
        </span>
        {row.status !== 'eligible' && (
          <span className="pool-reason">{row.entry.reasons.map((r) => exclusionText(r, props.view)).join('; ')}</span>
        )}
      </td>
      <td className="num right">{d.requiredItemLevel}</td>
      <td className="num right hide-sm">{d.modifierLevel}</td>
      <td className="num right">{row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight)}</td>
      {mode.kind === 'inspect' && <td className="num right">{row.share === null ? '—' : formatPercent(row.share)}</td>}
      <td>
        <span className={`status status-${row.status}`}>{EXPLORER_STATUS_LABEL[row.status]}</span>
      </td>
      {mode.kind !== 'inspect' && (
        <td className="right">
          <button
            type="button"
            className="btn btn-small"
            disabled={row.status !== 'eligible'}
            onClick={() => props.onPick(d)}
          >
            {mode.kind === 'edit-target' ? (d.tier === 1 ? 'T1' : `T${d.tier}+`) : 'Выбрать'}
          </button>
        </td>
      )}
    </tr>
  );
}

function filterGroups(groups: readonly ExplorerGroup[], query: string, status: ExplorerStatus | 'all'): ExplorerGroup[] {
  const q = query.trim().toLowerCase();
  return groups.flatMap((group) => {
    const rows = group.rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!q) return true;
      const d = r.entry.definition;
      const haystack = [modifierText(d), d.name, group.label, ...d.tags].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    return rows.length > 0 ? [{ ...group, rows }] : [];
  });
}
