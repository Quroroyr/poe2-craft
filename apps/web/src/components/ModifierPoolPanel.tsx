import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { modifierText, type ModifierDefinition } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { isPickSelected, type PickOption, type PickOptions } from '@poe2-craft/craft-session';
import type { ExplorerGroup, ExplorerRow, ExplorerStatus, ExplorerTabId, PoolExplorer } from '@poe2-craft/probability-engine';
import type { ExplorerMode } from '@/lib/analyze';
import { formatInt, formatPercent } from '@/lib/format';
import { EXPLORER_STATUS_LABEL, exclusionText } from '@/lib/texts';
import { Icon } from './Icon';
import { Panel } from './Panel';

const TAB_LABEL: Record<ExplorerTabId, string> = { prefix: 'Префиксы', suffix: 'Суффиксы' };

/**
 * `pickable` (editing only): what a click can add or swap to, plus what is already selected.
 * Selected rows survive every status filter, so a row never disappears under the cursor.
 */
type StatusFilter = ExplorerStatus | 'all' | 'pickable';

/**
 * "Show in pool": open this tab and family and bring this tier into view. A navigation request,
 * not a filter: it clears search, tag and status so the row cannot be hidden. `nonce` grows with
 * every request, so asking again for the same modifier still scrolls to it.
 */
export interface PoolFocus {
  readonly modifierId: string;
  readonly tab: ExplorerTabId;
  readonly familyKey: string;
  readonly nonce: number;
}

interface ModifierPoolPanelProps {
  readonly explorer: PoolExplorer | null;
  readonly mode: ExplorerMode;
  readonly view: CraftDbView;
  /** Modifier ids of the current stage target, highlighted in inspect mode. */
  readonly highlightIds: ReadonlySet<string>;
  /** What a click on each tier does in edit modes (from the real source / target); null in inspect. */
  readonly picks: PickOptions | null;
  readonly focus: PoolFocus | null;
  readonly toolLabel: string | null;
  readonly onPick: (definition: ModifierDefinition) => void;
  readonly onExit: () => void;
}

/**
 * One explorer for every job: inspect the current item's pool for the active tool, pick a
 * modifier for the source, or pick a requirement for the target. Families on the left; on the
 * right a dense technical table when inspecting and a compact picker (a whole row = one click)
 * when editing. The engine and craft-session decide statuses; this component filters and shows.
 * Navigation and filters are local state that a pick never resets.
 */
export function ModifierPoolPanel(props: ModifierPoolPanelProps) {
  const { explorer, mode, view, picks } = props;
  const editing = mode.kind !== 'inspect';
  const [tabId, setTabId] = useState<ExplorerTabId>(mode.kind === 'inspect' ? 'suffix' : mode.side);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(editing ? 'pickable' : 'all');
  const [familyKey, setFamilyKey] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const scrollPending = useRef(false);
  const focus = props.focus;

  useEffect(() => {
    if (!focus) return;
    setTabId(focus.tab);
    setFamilyKey(focus.familyKey);
    setQuery('');
    setTag('');
    setStatusFilter('all');
    scrollPending.current = true;
  }, [focus]);

  // After the focused family is rendered, scroll its tier into the middle of the table.
  useLayoutEffect(() => {
    if (!scrollPending.current || !focus) return;
    const wrap = tableRef.current;
    const row = wrap?.querySelector<HTMLElement>(`[data-modifier-id="${focus.modifierId}"]`);
    if (!wrap || !row) return;
    scrollPending.current = false;
    wrap.scrollTop = Math.max(0, row.offsetTop - wrap.clientHeight / 2);
  });

  const tab = explorer?.tabs.find((t) => t.id === tabId) ?? explorer?.tabs[0];
  const allTags = useMemo(
    () => [...new Set(explorer?.tabs.flatMap((t) => t.groups.flatMap((g) => g.rows.flatMap((r) => r.entry.definition.tags))) ?? [])].sort(),
    [explorer],
  );
  const groups = useMemo(
    () => filterGroups(tab?.groups ?? [], query, tag, statusFilter, picks),
    [tab, query, tag, statusFilter, picks],
  );
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
                    {editing ? pickableCount(t.groups, picks) : t.counts.eligible}
                    {mode.kind === 'inspect' && t.share !== null && ` · ${formatPercent(t.share)}`}
                  </span>
                </button>
              ))}
            </div>
            <select
              name="pool-status"
              aria-label="Статус"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              {editing && <option value="pickable">Доступные и выбранные</option>}
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

            {editing ? (
              <div className="pick-scroll">
                {shown.length === 0 ? (
                  <p className="empty">Ничего не найдено.</p>
                ) : (
                  shown.map((g) => (
                    <section key={g.key} className="pick-group" aria-label={g.label}>
                      <h4 className="pick-family">{g.label}</h4>
                      <ul className="pick-list">
                        {byTier(g.rows).map((row) => (
                          <PickRow
                            key={row.entry.definition.id}
                            row={row}
                            option={picks?.get(row.entry.definition.id)}
                            mode={mode}
                            view={view}
                            onPick={props.onPick}
                          />
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </div>
            ) : (
              <div ref={tableRef} className="table-scroll pool-table-wrap">
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
                        <th className="right">Доля</th>
                        <th className="hide-md">Группа</th>
                        <th className="hide-md">Теги</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.flatMap((g) =>
                        byTier(g.rows).map((row) => (
                          <TierRow
                            key={row.entry.definition.id}
                            row={row}
                            group={g}
                            view={view}
                            isTarget={props.highlightIds.has(row.entry.definition.id)}
                            isFocus={focus?.modifierId === row.entry.definition.id}
                          />
                        )),
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
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
      : mode.kind === 'edit-current'
        ? 'Замена мода текущего предмета — ручная правка, не крафт'
        : mode.replaceIndex !== undefined
          ? 'Замена мода исходного'
          : 'Добавление мода в исходный';
  return (
    <p className={`mode-line mode-line-edit${mode.kind === 'edit-current' ? ' mode-line-manual' : ''}`}>
      {label}
      <button type="button" className="link-btn" onClick={onExit}>
        вернуться к осмотру <kbd>Esc</kbd>
      </button>
    </p>
  );
}

/** Inspect mode: the technical row with every column. */
function TierRow(props: { row: ExplorerRow; group: ExplorerGroup; view: CraftDbView; isTarget: boolean; isFocus: boolean }) {
  const { row } = props;
  const d = row.entry.definition;
  const reasons = row.status !== 'eligible' ? row.entry.reasons.map((r) => exclusionText(r, props.view)).join('; ') : undefined;
  return (
    <tr
      className={`tier-row row-${row.status}${props.isTarget ? ' is-target' : ''}${props.isFocus ? ' is-focus' : ''}`}
      title={reasons}
      data-modifier-id={d.id}
      aria-current={props.isFocus || undefined}
    >
      <td>
        <span className="pool-mod">{modifierText(d)}</span>
        <span className="pool-name">
          {d.name}
          {props.isTarget && <span className="tag tag-target">цель</span>}
        </span>
      </td>
      <td className="num right">T{d.tier}</td>
      <td className="num right">{d.requiredItemLevel}</td>
      <td className="num right hide-md">{d.modifierLevel}</td>
      <td className="num right">{row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight)}</td>
      <td className="num right">{row.share === null ? '—' : formatPercent(row.share)}</td>
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
    </tr>
  );
}

/**
 * Edit modes: the whole row is the control. Click, Enter or Space picks the tier; a selected
 * row stays in place with a check; an unavailable row says why and ignores the click.
 */
function PickRow(props: {
  row: ExplorerRow;
  option: PickOption | undefined;
  mode: ExplorerMode;
  view: CraftDbView;
  onPick: (definition: ModifierDefinition) => void;
}) {
  const { row, option, mode } = props;
  const d = row.entry.definition;
  const selected = isPickSelected(option);
  const allowed = option?.allowed ?? false;
  const swap = option?.action.kind === 'replace' || option?.action.kind === 'retier';
  const reasons = !allowed && !selected ? (option?.reasons ?? row.entry.reasons).map((r) => exclusionText(r, props.view)) : [];
  const text = modifierText(d);
  const state = selected ? 'selected' : allowed ? 'allowed' : 'unavailable';
  // Target requirements mean "this tier or better".
  const tierLabel = mode.kind === 'edit-target' && d.tier > 1 ? `T${d.tier}+` : `T${d.tier}`;

  const pick = () => {
    if (allowed) props.onPick(d);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick();
    }
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={selected || allowed ? 0 : -1}
        className={`pick-row pick-${state}`}
        aria-pressed={selected}
        aria-disabled={!allowed && !selected}
        data-modifier-id={d.id}
        title={reasons.length > 0 ? reasons.join('; ') : undefined}
        onClick={pick}
        onKeyDown={onKeyDown}
      >
        <span className="pick-tier num">
          {selected && <Icon name="check" size={13} />}
          {swap && allowed && (
            <span className="pick-swap" title="Заменит выбранный тир этого семейства">
              <Icon name="swap" size={12} />
            </span>
          )}
          {tierLabel}
        </span>
        <span className="pick-main">
          <span className="pick-mod" title={text}>
            {text}
          </span>
          <span className={`pick-meta${reasons.length > 0 ? ' pick-meta-reason' : ''}`}>
            {selected && <span className="pick-state">{mode.kind === 'edit-target' ? 'в цели' : 'выбран'} · </span>}
            {reasons.length > 0 ? (
              <span className="pick-reason">{reasons.join('; ')}</span>
            ) : (
              <>
                {d.name}
                <span className="pick-sep"> · </span>ур. мода {d.modifierLevel}
                {d.tags.length > 0 && <span className="pick-sep"> · </span>}
                {d.tags.join(', ')}
              </>
            )}
          </span>
        </span>
        <span className="pick-num num">
          <span className="pick-unit">ilvl</span> {d.requiredItemLevel}
        </span>
        <span className="pick-num num">
          <span className="pick-unit">вес</span>{' '}
          {row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight)}
        </span>
      </div>
    </li>
  );
}

/** Editing: tiers a click would add or swap to on this tab. */
function pickableCount(groups: readonly ExplorerGroup[], picks: PickOptions | null): number {
  return groups.reduce((n, g) => n + g.rows.filter((r) => picks?.get(r.entry.definition.id)?.allowed).length, 0);
}

function byTier(rows: readonly ExplorerRow[]): ExplorerRow[] {
  return [...rows].sort((a, b) => a.entry.definition.tier - b.entry.definition.tier);
}

function filterGroups(
  groups: readonly ExplorerGroup[],
  query: string,
  tag: string,
  status: StatusFilter,
  picks: PickOptions | null,
): ExplorerGroup[] {
  const q = query.trim().toLowerCase();
  return groups.flatMap((group) => {
    const rows = group.rows.filter((r) => {
      const d = r.entry.definition;
      const option = picks?.get(d.id);
      if (!isPickSelected(option)) {
        if (status === 'pickable' && !option?.allowed) return false;
        if (status !== 'all' && status !== 'pickable' && r.status !== status) return false;
      }
      if (tag && !d.tags.includes(tag)) return false;
      if (!q) return true;
      return [modifierText(d), d.name, group.label, ...d.tags].join(' ').toLowerCase().includes(q);
    });
    return rows.length > 0 ? [{ ...group, rows }] : [];
  });
}
