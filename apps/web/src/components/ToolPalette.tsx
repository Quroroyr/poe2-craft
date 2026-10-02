import { useState } from 'react';
import type { Consumable, ConsumableCategory } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  EMPTY_TOOL,
  selectCurrency,
  toggleOmen,
  toolPalette,
  type ResolvedTool,
  type ToolSelection,
} from '@poe2-craft/craft-session';
import type { AttemptCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import type { StageTargetOption } from '@/lib/analyze';
import { formatAttempts, formatCost, formatPercent } from '@/lib/format';
import { consumableIconUrl } from '@/lib/icons';
import { parsePriceInput, type PriceInputs } from '@/lib/prices';
import { GameIcon } from './GameIcon';
import { Icon } from './Icon';

/** Palette tabs. Only categories with an implemented model have tools; the rest show what is planned. */
const TABS: readonly { id: string; label: string; category?: ConsumableCategory }[] = [
  { id: 'currency', label: 'Валюта', category: 'currency' },
  { id: 'omen', label: 'Omens', category: 'omen' },
  { id: 'essence', label: 'Essences' },
  { id: 'catalyst', label: 'Catalysts' },
  { id: 'desecration', label: 'Desecration' },
  { id: 'runes', label: 'Runes' },
];

interface ToolPaletteProps {
  readonly view: CraftDbView;
  readonly selection: ToolSelection;
  readonly onSelect: (selection: ToolSelection) => void;
  readonly resolved: ResolvedTool;
  readonly priceInputs: PriceInputs;
  readonly attemptCost: AttemptCost | null;
  readonly probability: ProbabilityResult | null;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTargetKey: string | null;
  readonly onStageTarget: (key: string) => void;
}

/** Image-first crafting tools above the current item, and what the held combination does per click. */
export function ToolPalette(props: ToolPaletteProps) {
  const { view, selection } = props;
  const [tabId, setTabId] = useState('currency');
  const palette = toolPalette(view);
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0]!;
  const tools = tab.category ? (palette.byCategory[tab.category] ?? []) : [];

  const isSelected = (c: Consumable) => selection.currencyId === c.id || selection.omenIds.includes(c.id);
  const pick = (c: Consumable) =>
    props.onSelect(c.category === 'omen' ? toggleOmen(selection, c.id) : selectCurrency(selection, c.id));

  return (
    <div className="toolbar" aria-label="Инструменты крафта">
      <div className="toolbar-tabs" role="tablist" aria-label="Категория инструментов">
        {TABS.map((t) => {
          const count = t.category ? (palette.byCategory[t.category]?.length ?? 0) : 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab.id}
              className={`toolbar-tab${count === 0 ? ' toolbar-tab-dim' : ''}`}
              onClick={() => setTabId(t.id)}
              title={count === 0 ? 'Нет подтверждённой модели механики — инструментов пока нет' : undefined}
            >
              {t.label}
              {count === 0 && <span className="toolbar-tab-soon">скоро</span>}
            </button>
          );
        })}
        <span className="badge badge-warn toolbar-badge">демо-модели</span>
      </div>

      {tools.length === 0 ? (
        <p className="empty toolbar-empty">
          Пока не реализовано: для этой категории нет подтверждённой модели механики, поэтому инструментов нет.
        </p>
      ) : (
        <div className="tool-strip">
          {tools.map((c) => {
            const price = parsePriceInput(props.priceInputs[c.id]);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={isSelected(c)}
                className="tool-tile"
                onClick={() => pick(c)}
                title={c.name}
              >
                <GameIcon src={consumableIconUrl(c)} label={c.name} size={44} />
                <span className="tool-name">{c.name.replace(/^Omen of /, '')}</span>
                <span className="tool-price num">{price === null ? 'нет цены' : formatCost(price, 'div')}</span>
              </button>
            );
          })}
        </div>
      )}
      {tab.category === 'omen' && (
        <p className="hint toolbar-hint">Omen меняет действие сферы: выберите сферу во вкладке «Валюта» и Omen здесь.</p>
      )}

      <ActiveCraft {...props} />
    </div>
  );
}

function ActiveCraft(props: ToolPaletteProps) {
  const { resolved, probability, attemptCost } = props;
  const consumables = resolved.status === 'none' ? [] : resolved.consumables;
  return (
    <div className={`active-craft active-craft-${resolved.status}`} aria-label="Активный крафт">
      <div className="active-craft-combo">
        {consumables.length === 0 ? (
          <span className="muted">Ничего не выбрано — возьмите сферу из палитры.</span>
        ) : (
          consumables.map((c, i) => (
            <span key={c.id} className="combo-part">
              {i > 0 && <Icon name="plus" size={12} className="combo-plus" />}
              <GameIcon src={consumableIconUrl(c)} label={c.name} size={28} />
              <span>{c.name}</span>
            </span>
          ))
        )}
        {consumables.length > 0 && (
          <button type="button" className="icon-btn" aria-label="Положить инструмент" onClick={() => props.onSelect(EMPTY_TOOL)}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {resolved.status === 'unsupported' && (
        <p className="active-craft-warn">Такая комбинация не смоделирована — клик ничего не сделает.</p>
      )}
      {resolved.status === 'ready' && (
        <dl className="active-craft-facts">
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
                  : 'недоступна'}
            </dd>
          </div>
          <div className="active-craft-stage">
            <dt>
              <label htmlFor="stage-target">Цель шага</label>
            </dt>
            <dd>
              <select
                id="stage-target"
                name="stage-target"
                value={props.stageTargetKey ?? ''}
                onChange={(e) => props.onStageTarget(e.target.value)}
              >
                {props.stageTargets.some((o) => o.origin === 'target-item') && (
                  <optgroup label="Не хватает до цели">
                    {props.stageTargets
                      .filter((o) => o.origin === 'target-item')
                      .map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.target.label}
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Каталог (fixture)">
                  {props.stageTargets
                    .filter((o) => o.origin === 'catalog')
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.target.label}
                      </option>
                    ))}
                </optgroup>
              </select>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
