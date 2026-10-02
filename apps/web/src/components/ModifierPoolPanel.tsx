import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { modifierText, type ModifierDefinition } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { isPickSelected, type PickOption, type PickOptions } from '@poe2-craft/craft-session';
import type { ExplorerGroup, ExplorerRow, ExplorerStatus, ExplorerTabId, PoolExplorer } from '@poe2-craft/probability-engine';
import type { ExplorerMode } from '@/lib/analyze';
import { formatInt, formatPercent } from '@/lib/format';
import { INTL_LOCALE } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { explorerStatusLabel, exclusionText, exclusionsText, sidesLabel } from '@/lib/texts';
import { Icon } from './Icon';
import { Panel } from './Panel';

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
  /** Seal number on the main page; none inside the setup surface. */
  readonly index?: number;
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
  const { t, locale } = useI18n();
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
      index={props.index}
      title={t('pool.title')}
      className="panel-pool"
      aside={
        <>
          <label className="search-field search-compact">
            <Icon name="search" size={15} />
            <input type="search" name="pool-search" aria-label={t('pool.search')} placeholder={t('pool.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <select name="pool-tag" aria-label={t('pool.tag')} value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">{t('pool.allTags')}</option>
            {allTags.map((name) => (
              <option key={name} value={name}>
                {name}
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
            ? t('pool.emptyInspect')
            : t('pool.emptyEdit')}
        </p>
      ) : (
        <>
          <div className="pool-bar">
            <div className="segmented" role="tablist" aria-label={t('pool.sides')}>
              {explorer.tabs.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  role="tab"
                  aria-selected={tb.id === tab.id}
                  aria-pressed={tb.id === tab.id}
                  onClick={() => {
                    setTabId(tb.id);
                    setFamilyKey(null);
                  }}
                >
                  {tb.id === 'prefix' || tb.id === 'suffix' ? sidesLabel(t, tb.side) : t(`pool.layer.${tb.id}`)}
                  <span className="seg-meta num">
                    {tb.specials?.length ?? (editing ? pickableCount(tb.groups, picks) : tb.counts.eligible)}
                    {mode.kind === 'inspect' && tb.share !== null && ` · ${formatPercent(tb.share)}`}
                  </span>
                </button>
              ))}
            </div>
            <select
              name="pool-status"
              aria-label={t('pool.status')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              {editing && <option value="pickable">{t('pool.pickable')}</option>}
              <option value="all">{t('pool.allStatuses')}</option>
              {(['eligible', 'already-present', 'blocked', 'excluded'] as const).map((s) => (
                <option key={s} value={s}>
                  {t('pool.statusOption', { label: explorerStatusLabel(t, s), count: tab.counts[s] })}
                </option>
              ))}
            </select>
          </div>

          <div className="pool-body">
            <ul className="family-list" aria-label={t('pool.families')}>
              <li>
                <button type="button" className="family-item" aria-pressed={familyKey === null} onClick={() => setFamilyKey(null)}>
                  <span>{t('pool.allFamilies')}</span>
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

            {tab.specials ? (
              <ul className="pick-list" style={{ gridColumn: '1 / -1' }}>
                {tab.specials.map((m) => <li key={m.id} className="pick-row"><span>{m.lines.map((l) => l.template).join(' / ') || m.id}</span><span className="muted">{t('data.notModelled')}</span></li>)}
              </ul>
            ) : editing ? (
              <div className="pick-scroll">
                {shown.length === 0 ? (
                  <p className="empty">{t('pool.nothing')}</p>
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
                  <p className="empty">{t('pool.nothing')}</p>
                ) : (
                  <table className="table pool-table">
                    <thead>
                      <tr>
                        <th>{t('pool.col.mod')}</th>
                        <th className="right">{t('pool.col.tier')}</th>
                        <th className="right">ilvl</th>
                        <th className="right hide-md">{t('pool.col.modLevel')}</th>
                        <th className="right">{t('pool.col.weight')}</th>
                        <th className="right">{t('pool.col.share')}</th>
                        <th className="hide-md">{t('pool.col.group')}</th>
                        <th className="hide-md">{t('pool.col.tags')}</th>
                        <th>{t('pool.col.status')}</th>
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
            <p className="hint">{t('pool.hidden', { count: explorer.hiddenNotSpawnable })}</p>
          )}
        </>
      )}
    </Panel>
  );
}

function ModeChip({ mode, toolLabel, onExit }: { mode: ExplorerMode; toolLabel: string | null; onExit: () => void }) {
  const { t } = useI18n();
  if (mode.kind === 'inspect') {
    return <p className="mode-line">{toolLabel ? t('pool.inspectWith', { tool: toolLabel }) : t('pool.inspect')}</p>;
  }
  const label = t(
    mode.kind === 'edit-target'
      ? 'pool.mode.target'
      : mode.kind === 'edit-current'
        ? 'pool.mode.current'
        : mode.replaceIndex !== undefined
          ? 'pool.mode.sourceReplace'
          : 'pool.mode.sourceAdd',
  );
  return (
    <p className={`mode-line mode-line-edit${mode.kind === 'edit-current' ? ' mode-line-manual' : ''}`}>
      {label}
      <button type="button" className="link-btn" onClick={onExit}>
        {t('pool.backToInspect')} <kbd>Esc</kbd>
      </button>
    </p>
  );
}

/** Inspect mode: the technical row with every column. */
function TierRow(props: { row: ExplorerRow; group: ExplorerGroup; view: CraftDbView; isTarget: boolean; isFocus: boolean }) {
  const { row } = props;
  const { t, locale } = useI18n();
  const d = row.entry.definition;
  const reasons = row.status !== 'eligible' ? exclusionsText(t, row.entry.reasons, props.view) : undefined;
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
          {props.isTarget && <span className="tag tag-target">{t('pool.targetTag')}</span>}
        </span>
      </td>
      <td className="num right">T{row.tier}</td>
      <td className="num right">{d.requiredItemLevel}</td>
      <td className="num right hide-md">{d.modifierLevel}</td>
      <td className="num right">{row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight, INTL_LOCALE[locale])}</td>
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
        <span className={`status status-${row.status}`}>{explorerStatusLabel(t, row.status)}</span>
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
  const { t, locale } = useI18n();
  const d = row.entry.definition;
  const selected = isPickSelected(option);
  const allowed = option?.allowed ?? false;
  const swap = option?.action.kind === 'replace' || option?.action.kind === 'retier';
  const reasons = !allowed && !selected ? (option?.reasons ?? row.entry.reasons).map((r) => exclusionText(t, r, props.view)) : [];
  const text = modifierText(d);
  const state = selected ? 'selected' : allowed ? 'allowed' : 'unavailable';
  // Target requirements mean "this tier or better".
  const tierLabel = mode.kind === 'edit-target' && row.tier > 1 ? `T${row.tier}+` : `T${row.tier}`;

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
            <span className="pick-swap" title={t('pool.swapTitle')}>
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
            {selected && <span className="pick-state">{t(mode.kind === 'edit-target' ? 'pool.inTarget' : 'pool.selected')} · </span>}
            {reasons.length > 0 ? (
              <span className="pick-reason">{reasons.join('; ')}</span>
            ) : (
              <>
                {d.name}
                <span className="pick-sep"> · </span>{t('pool.modLevel', { level: d.modifierLevel })}
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
          <span className="pick-unit">{t('pool.weight')}</span>{' '}
          {row.entry.weight === null ? <span className="bad">?</span> : formatInt(row.entry.weight, INTL_LOCALE[locale])}
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
  return [...rows].sort((a, b) => a.tier - b.tier);
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
