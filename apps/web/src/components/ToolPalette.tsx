import { useMemo, useRef, useState } from 'react';
import type { Consumable, ConsumableCategory } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  EMPTY_TOOL,
  clearOmens,
  pickTool,
  type ResolvedTool,
  type ToolPalette as Palette,
  type ToolSelection,
} from '@poe2-craft/craft-session';
import type { AttemptCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { formatAttempts, formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { parsePriceInput, type PriceInputs } from '@/lib/prices';
import { TOOL_CATEGORY_LABEL } from '@/lib/texts';
import { GameIcon } from './GameIcon';
import { Icon } from './Icon';
import { Panel } from './Panel';

const CATEGORIES: readonly ConsumableCategory[] = ['currency', 'omen', 'essence', 'catalyst', 'rune'];

interface ToolPaletteProps {
  readonly view: CraftDbView;
  readonly palette: Palette;
  readonly selection: ToolSelection;
  readonly onSelect: (selection: ToolSelection) => void;
  readonly resolved: ResolvedTool;
  readonly priceInputs: PriceInputs;
  readonly attemptCost: AttemptCost | null;
  readonly probability: ProbabilityResult | null;
}

/** Wide icon-first strip of crafting tools, and the active craft (currency + omen) it puts in hand. */
export function ToolPalette(props: ToolPaletteProps) {
  const { palette, selection } = props;
  const [category, setCategory] = useState<ConsumableCategory>('currency');
  const [query, setQuery] = useState('');
  const [wrap, setWrap] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const tools = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? CATEGORIES.flatMap((c) => palette.byCategory[c] ?? [])
      : (palette.byCategory[category] ?? []);
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [palette, category, query]);

  const isSelected = (c: Consumable) => selection.currencyId === c.id || selection.omenIds.includes(c.id);
  const scroll = (dir: number) => stripRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });

  return (
    <Panel
      index={4}
      title="Инструменты крафта"
      className="panel-tools"
      aside={
        <>
          <div className="tool-tabs" role="tablist" aria-label="Категория инструментов">
            {CATEGORIES.map((c) => (
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
                {TOOL_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
          <label className="search-field search-compact">
            <Icon name="search" size={15} />
            <input
              type="search"
              name="tool-search"
              aria-label="Поиск инструмента"
              placeholder="Поиск валюты…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-pressed={wrap}
            aria-label={wrap ? 'Одной полосой' : 'Сеткой'}
            title={wrap ? 'Одной полосой' : 'Сеткой'}
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
            <button type="button" className="strip-arrow" aria-label="Прокрутить влево" onClick={() => scroll(-1)}>
              <Icon name="left" size={16} />
            </button>
          )}
          <div className="tool-strip" ref={stripRef} role="listbox" aria-label="Инструменты" aria-multiselectable="true">
            {tools.length === 0 && <p className="empty strip-empty">Ничего не найдено.</p>}
            {tools.map((c) => {
              const modelled = palette.modelled.has(c.id);
              const price = parsePriceInput(props.priceInputs[c.id]);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected(c)}
                  className={`tool-tile${modelled ? '' : ' tool-tile-dim'}${c.category === 'omen' ? ' tool-tile-omen' : ''}`}
                  title={`${c.name}${modelled ? '' : ' — механика не смоделирована'}${price === null ? '' : ` · ${formatCost(price, 'div')}`}`}
                  onClick={() => props.onSelect(pickTool(selection, c))}
                >
                  <GameIcon src={consumableIconUrl(c)} label={c.name} size={44} />
                  <span className="tool-name">{c.name.replace(/^Omen of /, '')}</span>
                  {!modelled && <span className="tool-flag">не смоделировано</span>}
                </button>
              );
            })}
          </div>
          {!wrap && (
            <button type="button" className="strip-arrow" aria-label="Прокрутить вправо" onClick={() => scroll(1)}>
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
  const currency = selection.currencyId ? view.getConsumable(selection.currencyId) : undefined;
  const omens = selection.omenIds.flatMap((id) => view.getConsumable(id) ?? []);
  const incompatible = resolved.status === 'incompatible' ? new Set(resolved.incompatibleOmenIds) : new Set<string>();

  return (
    <aside className={`active-craft active-${resolved.status}`} aria-label="Активный крафт" aria-live="polite">
      <div className="active-title">Активный крафт</div>
      <div className="active-combo">
        {currency ? (
          <span className="combo-part">
            <GameIcon src={consumableIconUrl(currency)} label={currency.name} size={34} />
            <span className="combo-name">{currency.name}</span>
            <button type="button" className="icon-btn icon-btn-quiet" aria-label={`Убрать ${currency.name}`} onClick={() => props.onSelect({ ...selection, currencyId: null })}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ) : (
          <span className="combo-empty">Возьмите валюту</span>
        )}
        {omens.map((omen) => (
          <span key={omen.id} className={`combo-part combo-omen${incompatible.has(omen.id) ? ' combo-bad' : ''}`}>
            <Icon name="plus" size={12} className="combo-plus" />
            <GameIcon src={consumableIconUrl(omen)} label={omen.name} size={28} />
            <span className="combo-name">{omen.name}</span>
            <button type="button" className="icon-btn icon-btn-quiet" aria-label={`Убрать ${omen.name}`} onClick={() => props.onSelect(clearOmens(selection))}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="active-status">
        {resolved.status === 'ready' && (
          <dl className="active-facts">
            <div>
              <dt>Цена клика</dt>
              <dd className="num">{attemptCost ? formatCost(attemptCost.total, attemptCost.unit) : '—'}</dd>
            </div>
            <div>
              <dt>Шанс цели шага</dt>
              <dd className="num accent">
                {probability?.status === 'ok'
                  ? `${formatPercent(probability.probability)} · ≈${formatAttempts(probability.expectedAttempts)}`
                  : probability?.status === 'already-satisfied'
                    ? 'уже есть'
                    : 'недоступен'}
              </dd>
            </div>
          </dl>
        )}
        {resolved.status === 'incompatible' && (
          <p className="status-line status-bad">
            {omens.filter((o) => incompatible.has(o.id)).map((o) => o.name).join(', ')} не действует на {currency?.name}. Клик ничего не
            сделает.
          </p>
        )}
        {resolved.status === 'unsupported' && (
          <p className="status-line status-warn">
            {omens.length > 0 ? 'Комбинация совместима, но не смоделирована' : 'Механика этой валюты ещё не смоделирована'} — клик
            ничего не сделает и не потратит.
          </p>
        )}
        {resolved.status === 'none' && (
          <p className="status-line muted">
            {omens.length > 0 ? 'Omen выбран и ждёт валюту.' : 'Выберите валюту в полосе слева.'}
          </p>
        )}
      </div>
      {(currency || omens.length > 0) && (
        <button type="button" className="link-btn active-clear" onClick={() => props.onSelect(EMPTY_TOOL)}>
          Положить всё
        </button>
      )}
    </aside>
  );
}
