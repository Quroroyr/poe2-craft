import { useState } from 'react';
import type { Consumable, ConsumableCategory } from '@poe2-craft/craft-domain';
import type { CraftDb, CraftDbView } from '@poe2-craft/craft-db';
import {
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
import { Panel } from './Panel';

/** Palette tabs. Only categories with an implemented model have tools; the rest show what is planned. */
const TABS: readonly { id: string; label: string; category?: ConsumableCategory }[] = [
  { id: 'currency', label: 'Валюта', category: 'currency' },
  { id: 'omen', label: 'Omens', category: 'omen' },
  { id: 'essence', label: 'Essences' },
  { id: 'catalyst', label: 'Catalysts' },
  { id: 'desecration', label: 'Desecration' },
  { id: 'runes', label: 'Runes / Socketables' },
];

interface ToolPaletteProps {
  readonly db: CraftDb;
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
  readonly gameVersion: string;
  readonly onGameVersion: (version: string) => void;
}

export function ToolPalette(props: ToolPaletteProps) {
  const { view, selection, resolved } = props;
  const [tabId, setTabId] = useState('currency');
  const palette = toolPalette(view);
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0]!;
  const tools = tab.category ? (palette.byCategory[tab.category] ?? []) : [];

  const isSelected = (c: Consumable) => selection.currencyId === c.id || selection.omenIds.includes(c.id);
  const pick = (c: Consumable) =>
    props.onSelect(c.category === 'omen' ? toggleOmen(selection, c.id) : selectCurrency(selection, c.id));

  return (
    <Panel title="Инструменты крафта" step="4" aside={<span className="badge badge-warn">демо-модели</span>}>
      <div className="palette">
        <div className="palette-main">
          <div className="tabs" role="tablist" aria-label="Категория">
            {TABS.map((t) => {
              const count = t.category ? (palette.byCategory[t.category]?.length ?? 0) : 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === tab.id}
                  className={`tab${t.id === tab.id ? ' tab-active' : ''}${count === 0 ? ' tab-dim' : ''}`}
                  onClick={() => setTabId(t.id)}
                >
                  {t.label}
                  <span className="tab-meta">{count === 0 ? 'скоро' : count}</span>
                </button>
              );
            })}
          </div>

          {tools.length === 0 ? (
            <p className="empty palette-empty">
              Пока не реализовано: для этой категории нет подтверждённой модели механики, поэтому инструментов нет.
            </p>
          ) : (
            <div className="tool-grid">
              {tools.map((c) => {
                const price = parsePriceInput(props.priceInputs[c.id]);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={isSelected(c)}
                    className={`tool-tile${isSelected(c) ? ' tool-selected' : ''}`}
                    onClick={() => pick(c)}
                  >
                    <GameIcon src={consumableIconUrl(c)} label={c.name} size={40} />
                    <span className="tool-name">{c.name}</span>
                    <span className="tool-price num">{price === null ? 'нет цены' : formatCost(price, 'div')}</span>
                  </button>
                );
              })}
            </div>
          )}
          {tab.category === 'omen' && (
            <p className="hint">Omen — модификатор к валюте: выберите сферу во вкладке «Валюта» и Omen здесь.</p>
          )}
        </div>

        <ActiveTool {...props} />
      </div>
    </Panel>
  );
}

function ActiveTool(props: ToolPaletteProps) {
  const { resolved, probability, attemptCost } = props;
  const consumables = resolved.status === 'none' ? [] : resolved.consumables;
  return (
    <aside className="active-tool" aria-label="Активный инструмент">
      <div className="kpi-label">Активный инструмент</div>
      {resolved.status === 'none' ? (
        <p className="empty">Не выбран. Выберите сферу.</p>
      ) : (
        <div className="active-tool-name">
          {consumables.map((c, i) => (
            <span key={c.id} className="unit">
              {i > 0 && <span className="muted">+</span>}
              <GameIcon src={consumableIconUrl(c)} label={c.name} size={26} /> {c.name}
            </span>
          ))}
        </div>
      )}
      {resolved.status === 'unsupported' && (
        <p className="state-box state-warn">Такая комбинация не смоделирована — применить нельзя.</p>
      )}
      {resolved.status === 'ready' && (
        <dl className="active-tool-facts">
          <div>
            <dt>Цена клика</dt>
            <dd className="num">{attemptCost ? formatCost(attemptCost.total, attemptCost.unit) : '—'}</dd>
          </div>
          <div>
            <dt>Шанс цели</dt>
            <dd className="num accent">
              {probability?.status === 'ok'
                ? `${formatPercent(probability.probability)} · ≈${formatAttempts(probability.expectedAttempts)}`
                : probability?.status === 'already-satisfied'
                  ? 'уже есть'
                  : 'недоступна'}
            </dd>
          </div>
        </dl>
      )}
      <label className="control">
        <span className="field-label">Цель шага (для шанса)</span>
        <select
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
      </label>
      <label className="control">
        <span className="field-label">Версия игры</span>
        <select name="game-version" value={props.gameVersion} onChange={(e) => props.onGameVersion(e.target.value)}>
          {props.db.supportedVersions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
