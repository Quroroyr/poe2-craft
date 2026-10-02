import { useMemo, useState } from 'react';
import { modifierText, type ModifierDefinition } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ExplorerGroup, ExplorerRow, ExplorerStatus, ExplorerTabId, PoolExplorer } from '@poe2-craft/probability-engine';
import type { ExplorerMode } from '@/lib/analyze';
import { formatInt, formatPercent } from '@/lib/format';
import { EXPLORER_STATUS_LABEL, exclusionText } from '@/lib/texts';
import { Icon } from './Icon';
import { Panel } from './Panel';

const TAB_LABEL: Record<ExplorerTabId, string> = { prefix: 'Префиксы', suffix: 'Суффиксы' };

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
 * modifier for the source, or pick a requirement for the target. Families on the left, a dense
 * tier table on the right. The engine decides statuses; this component filters and displays them.
 */
export function ModifierPoolPanel(props: ModifierPoolPanelProps) {
  const { explorer, mode, view } = props;
  const editing = mode.kind !== 'inspect';
  const [tabId, setTabId] = useState<ExplorerTabId>(mode.kind === 'inspect' ? 'suffix' : mode.side);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExplorerStatus | 'all'>(editing ? 'eligible' : 'all');
  const [familyKey, setFamilyKey] = useState<string | null>(null);

  const tab = explorer?.tabs.find((t) => t.id === tabId) ?? explorer?.tabs[0];
  const allTags = useMemo(
    () => [...new Set(explorer?.tabs.flatMap((t) => t.groups.flatMap((g) => g.rows.flatMap((r) => r.entry.definition.tags))) ?? [])].sort(),
    [explorer],
  );
  const groups = useMemo(() => filterGroups(tab?.groups ?? [], query, tag, statusFilter), [tab, query, tag, statusFilter]);
  const shown = familyKey ? groups.filter((g) => g.key === familyKey) : groups;

  return (
    <Panel
      index={5}
      title="Пул модов"
      className="panel-pool"
      aside={
        <>
          <label className="search-field search-compact">
            <Icon name="search" size={15} />
            <input type="search" name="pool-search" aria-label="Поиск мода" placeholder="Поиск модов…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <select name="pool-tag" aria-label="Тег" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Все теги</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </>
      }
    >
      <ModeChip mode={mode} toolLabel={props.toolLabel} onExit={props.onExit} />
      {!explorer || !tab ? (
        <p className="empty">
          {mode.kind === 'inspect'
            ? 'Возьмите валюту — здесь появится пул, из которого она добавляет моды.'
            : 'Пул не построен: нет предмета или база не найдена в CraftDB.'}
        </p>
      ) : (
        <>
          <div className="pool-bar">
            <div className="segmented" role="tablist" aria-label="Тип модов">
              {explorer.tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === tab.id}
                  aria-pressed={t.id === tab.id}
                  onClick={() => {
                    setTabId(t.id);
                    setFamilyKey(null);
                  }}
                >
                  {TAB_LABEL[t.id]}
                  <span className="seg-meta num">
                    {t.counts.eligible}
                    {mode.kind === 'inspect' && t.share !== null && ` · ${formatPercent(t.share)}`}
                  </span>
                </button>
              ))}
            </div>
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
          </div>

          <div className="pool-body">
            <ul className="family-list" aria-label="Семейства модов">
              <li>
                <button type="button" className="family-item" aria-pressed={familyKey === null} onClick={() => setFamilyKey(null)}>
                  <span>Все семейства</span>
                  <span className="num muted">{groups.reduce((n, g) => n + g.rows.length, 0)}</span>
                </button>
              </li>
              {groups.map((g) => (
                <li key={g.key}>
                  <button
                    type="button"
                    className={`family-item fam-${g.status}`}
                    aria-pressed={familyKey === g.key}
                    onClick={() => setFamilyKey(familyKey === g.key ? null : g.key)}
                  >
                    <span className="fam-dot" aria-hidden />
                    <span className="fam-label">{g.label}</span>
                    <span className="num muted">{g.rows.length}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="table-scroll pool-table-wrap">
              {shown.length === 0 ? (
                <p className="empty">Ничего не найдено.</p>
              ) : (
                <table className="table pool-table">
                  <thead>
                    <tr>
                      <th>Мод</th>
                      <th className="right">Тир</th>
                      <th className="right">ilvl</th>
                      <th className="right hide-md">Ур. мода</th>
                      <th className="right">Вес</th>
                      {mode.kind === 'inspect' && <th className="right">Доля</th>}
                      <th className="hide-md">Группа</th>
                      <th className="hide-md">Теги</th>
                      <th>Статус</th>
                      {editing && <th aria-label="Выбор" />}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.flatMap((g) =>
                      [...g.rows]
                        .sort((a, b) => a.entry.definition.tier - b.entry.definition.tier)
                        .map((row) => (
                          <TierRow
                            key={row.entry.definition.id}
                            row={row}
                            group={g}
                            mode={mode}
                            view={view}
                            isTarget={props.highlightIds.has(row.entry.definition.id)}
                            onPick={props.onPick}
                          />
                        )),
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
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
    return <p className="mode-line">Осмотр текущего предмета{toolLabel ? ` · ${toolLabel}` : ''}</p>;
  }
  const label =
    mode.kind === 'edit-target'
      ? 'Добавление требования в цель'
      : mode.replaceIndex !== undefined
        ? 'Замена мода исходного'
        : 'Добавление мода в исходный';
  return (
    <p className="mode-line mode-line-edit">
      {label}
      <button type="button" className="link-btn" onClick={onExit}>
        вернуться к осмотру <kbd>Esc</kbd>
      </button>
    </p>
  );
}

function TierRow(props: {
  row: ExplorerRow;
  group: ExplorerGroup;
  mode: ExplorerMode;
  view: CraftDbView;
  isTarget: boolean;
  onPick: (definition: ModifierDefinition) => void;
}) {
  const { row, mode } = props;
  const d = row.entry.definition;
  const reasons = row.status !== 'eligible' ? row.entry.reasons.map((r) => exclusionText(r, props.view)).join('; ') : undefined;
  return (
    <tr className={`tier-row row-${row.status}${props.isTarget ? ' is-target' : ''}`} title={reasons}>
      <td>
        <span className="pool-mod">{modifierText(d)}</span>
        <span className="pool-name">
          {d.name}
          {props.isTarget && mode.kind === 'inspect' && <span className="tag tag-target">цель</span>}
        </span>
      </td>
      <td className="num right">T{d.tier}</td>
      <td className="num right">{d.requiredItemLevel}</td>
      <td className="num right hide-md">{d.modifierLevel}</td>
      <td className="num right">{row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight)}</td>
      {mode.kind === 'inspect' && <td className="num right">{row.share === null ? '—' : formatPercent(row.share)}</td>}
      <td className="hide-md">
        <span className="cell-chip">{props.group.label}</span>
      </td>
      <td className="hide-md">
        {d.tags.map((t) => (
          <span key={t} className="cell-chip">
            {t}
          </span>
        ))}
      </td>
      <td>
        <span className={`status status-${row.status}`}>{EXPLORER_STATUS_LABEL[row.status]}</span>
      </td>
      {mode.kind !== 'inspect' && (
        <td className="right">
          <button type="button" className="btn btn-small" disabled={row.status !== 'eligible'} onClick={() => props.onPick(d)}>
            {mode.kind === 'edit-target' ? (d.tier === 1 ? 'T1' : `T${d.tier}+`) : 'Выбрать'}
          </button>
        </td>
      )}
    </tr>
  );
}

function filterGroups(groups: readonly ExplorerGroup[], query: string, tag: string, status: ExplorerStatus | 'all'): ExplorerGroup[] {
  const q = query.trim().toLowerCase();
  return groups.flatMap((group) => {
    const rows = group.rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      const d = r.entry.definition;
      if (tag && !d.tags.includes(tag)) return false;
      if (!q) return true;
      return [modifierText(d), d.name, group.label, ...d.tags].join(' ').toLowerCase().includes(q);
    });
    return rows.length > 0 ? [{ ...group, rows }] : [];
  });
}
