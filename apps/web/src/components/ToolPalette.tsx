import { Fragment, useMemo, useRef, useState } from 'react';
import type { Consumable, ConsumableCategory, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  EMPTY_TOOL,
  clearOmens,
  pickTool,
  usableTools,
  type ResolvedTool,
  type ToolBlock,
  type ToolPalette as Palette,
  type ToolSelection,
} from '@poe2-craft/craft-session';
import type { AttemptCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { formatAttempts, formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { parsePriceInput, type PriceInputs } from '@/lib/prices';
import { INTL_LOCALE } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { toolCategoryLabel } from '@/lib/texts';
import { GameIcon } from './GameIcon';
import { Icon } from './Icon';
import { Panel } from './Panel';
import { WeightSource } from './ProbabilityPanel';

const CATEGORIES: readonly ConsumableCategory[] = ['currency', 'omen', 'essence', 'catalyst', 'rune', 'soul-core', 'liquid-emotion', 'abyssal-bone'];

interface ToolPaletteProps {
  readonly view: CraftDbView;
  readonly palette: Palette;
  /** The current item: the "usable" view orders tools by what applies to it. */
  readonly item: ItemState | null;
  readonly selection: ToolSelection;
  readonly onSelect: (selection: ToolSelection) => void;
  readonly resolved: ResolvedTool;
  readonly priceInputs: PriceInputs;
  readonly priceUnit?: string;
  readonly attemptCost: AttemptCost | null;
  readonly probability: ProbabilityResult | null;
}

/** Wide icon-first strip of crafting tools, and the active craft (currency + omen) it puts in hand. */
export function ToolPalette(props: ToolPaletteProps) {
  const { palette, selection } = props;
  const { t } = useI18n();
  const [scope, setScope] = useState<'usable' | 'all'>('usable');
  const [category, setCategory] = useState<ConsumableCategory>('currency');
  const [query, setQuery] = useState('');
  const [wrap, setWrap] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const usable = useMemo(() => usableTools(props.view, palette, props.item, selection), [props.view, palette, props.item, selection]);
  const blocks = useMemo(() => new Map(usable.map((u) => [u.consumable.id, u.block] as const)), [usable]);
  const allCount = useMemo(() => CATEGORIES.reduce((n, c) => n + (palette.byCategory[c]?.length ?? 0), 0), [palette]);
  const tools = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scope === 'usable'
      ? usable.map((u) => u.consumable)
      : q
        ? CATEGORIES.flatMap((c) => palette.byCategory[c] ?? [])
        : (palette.byCategory[category] ?? []);
    const found = q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
    // "All": modelled tools first, the catalogued rest after a divider.
    return scope === 'all' ? [...found.filter((c) => palette.modelled.has(c.id)), ...found.filter((c) => !palette.modelled.has(c.id))] : found;
  }, [palette, category, query, scope, usable]);

  const isSelected = (c: Consumable) => selection.currencyId === c.id || selection.omenIds.includes(c.id);
  const scroll = (dir: number) => stripRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });

  return (
    <Panel
      index={3}
      title={t('tools.title')}
      className="panel-tools"
      aside={
        <>
          <div className="segmented tool-scope" role="group" aria-label={t('tools.scope')}>
            <button type="button" aria-pressed={scope === 'usable'} onClick={() => setScope('usable')}>
              {t('tools.usable')} <span className="chip-count">{usable.length}</span>
            </button>
            <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
              {t('tools.all')} <span className="chip-count">{allCount}</span>
            </button>
          </div>
          {scope === 'all' && <div className="tool-tabs" role="tablist" aria-label={t('tools.categories')}>
            {CATEGORIES.filter((c) => palette.byCategory[c]?.length).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={!query && c === category}
                className="tool-tab"
                onClick={() => {
                  setCategory(c);
                  setQuery('');
                }}
              >
                {toolCategoryLabel(t, c)}
              </button>
            ))}
          </div>}
          <label className="search-field search-compact">
            <Icon name="search" size={15} />
            <input
              type="search"
              name="tool-search"
              aria-label={t('tools.search')}
              placeholder={t('tools.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={wrap}
            aria-label={t(wrap ? 'tools.oneRow' : 'tools.grid')}
            title={t(wrap ? 'tools.oneRow' : 'tools.grid')}
            onClick={() => setWrap((w) => !w)}
          >
            <Icon name={wrap ? 'list' : 'grid'} size={15} />
          </button>
        </>
      }
    >
      <div className="tools-layout">
        <div className={`strip-wrap${wrap ? ' strip-wrap-grid' : ''}`}>
          {!wrap && (
            <button type="button" className="strip-arrow" aria-label={t('tools.scrollLeft')} onClick={() => scroll(-1)}>
              <Icon name="left" size={16} />
            </button>
          )}
          <div className="tool-strip" ref={stripRef} role="listbox" aria-label={t('tools.list')} aria-multiselectable="true">
            {tools.length === 0 && <p className="empty strip-empty">{t('tools.empty')}</p>}
            {tools.map((c, i) => {
              const modelled = palette.modelled.has(c.id);
              const divider = scope === 'all' && !modelled && (i === 0 || palette.modelled.has(tools[i - 1]!.id));
              const block = blocks.get(c.id) ?? null;
              const price = parsePriceInput(props.priceInputs[c.id]);
              return (
                <Fragment key={c.id}>
                {divider && (
                  <span className="strip-divider" role="presentation">
                    {t('tools.notModelledGroup')}
                  </span>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected(c)}
                  className={`tool-tile${modelled && !block ? '' : ' tool-tile-dim'}${c.category === 'omen' ? ' tool-tile-omen' : ''}`}
                  title={`${modelled ? c.name : t('tools.notModelledTitle', { name: c.name })}${block ? ` — ${blockText(t, block)}` : ''}${price === null ? '' : ` · ${formatCost(price, props.priceUnit ?? 'div')}`}`}
                  onClick={() => props.onSelect(pickTool(selection, c))}
                >
                  <GameIcon src={consumableIconUrl(c)} label={c.name} size={44} />
                  <span className="tool-name">{c.name.replace(/^Omen of /, '')}</span>
                  <span className="tool-flag">{!modelled ? t('tools.notModelled') : block ? blockText(t, block) : t('data.modelled')}</span>
                </button>
                </Fragment>
              );
            })}
          </div>
          {!wrap && (
            <button type="button" className="strip-arrow" aria-label={t('tools.scrollRight')} onClick={() => scroll(1)}>
              <Icon name="chevron" size={16} />
            </button>
          )}
        </div>
        <ActiveCraft {...props} />
      </div>
    </Panel>
  );
}

/**
 * What the next click on the current item uses. The omen is shown as part of the craft, stays when
 * the currency changes, and its compatibility with the held currency is always spelled out.
 */
function ActiveCraft(props: ToolPaletteProps) {
  const { resolved, view, selection, probability, attemptCost } = props;
  const { t, locale } = useI18n();
  const currency = selection.currencyId ? view.getConsumable(selection.currencyId) : undefined;
  const omens = selection.omenIds.flatMap((id) => view.getConsumable(id) ?? []);
  const incompatible = resolved.status === 'incompatible' ? new Set(resolved.incompatibleOmenIds) : new Set<string>();

  return (
    <aside className={`active-craft active-${resolved.status}`} aria-label={t('active.title')} aria-live="polite">
      <div className="active-title">{t('active.title')}</div>
      <div className="active-combo">
        {currency ? (
          <span className="combo-part">
            <GameIcon src={consumableIconUrl(currency)} label={currency.name} size={34} />
            <span className="combo-name">{currency.name}</span>
            <button type="button" className="icon-btn icon-btn-quiet" aria-label={t('active.remove', { name: currency.name })} onClick={() => props.onSelect({ ...selection, currencyId: null })}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ) : (
          <span className="combo-empty">{t('active.empty')}</span>
        )}
        {omens.map((omen) => (
          <span key={omen.id} className={`combo-part combo-omen${incompatible.has(omen.id) ? ' combo-bad' : ''}`}>
            <Icon name="plus" size={12} className="combo-plus" />
            <GameIcon src={consumableIconUrl(omen)} label={omen.name} size={28} />
            <span className="combo-name">{omen.name}</span>
            <button type="button" className="icon-btn icon-btn-quiet" aria-label={t('active.remove', { name: omen.name })} onClick={() => props.onSelect(clearOmens(selection))}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="active-status">
        {resolved.status === 'ready' && (
          <dl className="active-facts">
            <div>
              <dt>{t('active.clickCost')}</dt>
              <dd className="num">{attemptCost?.complete ? formatCost(attemptCost.total, attemptCost.unit) : '—'}</dd>
            </div>
            <div>
              <dt>{t('active.stepChance')}</dt>
              <dd className="num accent">
                {probability?.status === 'ok'
                  ? `${formatPercent(probability.probability)} · ≈${formatAttempts(probability.expectedAttempts, INTL_LOCALE[locale])}`
                  : probability?.status === 'already-satisfied'
                    ? t('active.already')
                    : t('active.unavailable')}
                {probability?.status === 'ok' && <WeightSource view={view} entries={probability.targetEntries} />}
              </dd>
            </div>
          </dl>
        )}
        {resolved.status === 'incompatible' && (
          <p className="status-line status-bad">
            {t('active.incompatible', {
              omens: omens.filter((o) => incompatible.has(o.id)).map((o) => o.name).join(', '),
              currency: currency?.name ?? '',
            })}
          </p>
        )}
        {resolved.status === 'unsupported' && (
          <p className="status-line status-warn">
            {t(omens.length > 0 ? 'active.unsupportedCombo' : 'active.unsupportedSingle')}
          </p>
        )}
        {resolved.status === 'none' && (
          <p className="status-line muted">
            {t(omens.length > 0 ? 'active.omenWaiting' : 'active.pickCurrency')}
          </p>
        )}
      </div>
      {(currency || omens.length > 0) && (
        <button type="button" className="link-btn active-clear" onClick={() => props.onSelect(EMPTY_TOOL)}>
          {t('active.dropAll')}
        </button>
      )}
    </aside>
  );
}

function blockText(t: ReturnType<typeof useI18n>['t'], block: ToolBlock): string {
  return t(`tools.block.${block}`);
}
