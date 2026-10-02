import { useState } from 'react';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { toolPalette, type SessionSpent, type SpentLine } from '@poe2-craft/craft-session';
import type { AttemptCost, StageCost } from '@poe2-craft/economy';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import type { StageTargetOption } from '@/lib/analyze';
import { formatAttempts, formatCost, formatPercent, formatQuantile } from '@/lib/format';
import { consumableIconUrl, unitIconUrl } from '@/lib/icons';
import type { PriceInputs } from '@/lib/prices';
import { INTL_LOCALE } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { GameIcon } from './GameIcon';
import { Icon } from './Icon';
import { Panel } from './Panel';

interface SpendingPanelProps {
  readonly view: CraftDbView;
  readonly spent: SessionSpent;
  readonly spentLines: readonly SpentLine[];
  /** The active branch has manual edits of the current item: "spent" covers craft steps only. */
  readonly hasManualEdits: boolean;
  readonly attemptCost: AttemptCost | null;
  readonly stageCost: StageCost | null;
  readonly probability: ProbabilityResult | null;
  readonly stageTargets: readonly StageTargetOption[];
  readonly stageTargetKey: string | null;
  readonly onStageTarget: (key: string) => void;
  readonly priceInputs: PriceInputs;
  readonly pricesAreMock: boolean;
  readonly onPrice: (consumableId: string, text: string) => void;
}

/**
 * Money already spent (fact, from recorded steps) kept apart from what the next click costs and
 * what the current stage is expected to cost (estimates).
 */
export function SpendingPanel(props: SpendingPanelProps) {
  const { view, spent, attemptCost, stageCost, probability } = props;
  const { t, locale } = useI18n();
  const intl = INTL_LOCALE[locale];
  const [tab, setTab] = useState<'costs' | 'prices'>('costs');
  const unit = attemptCost?.unit ?? spent.unit ?? 'div';
  const unitIcon = <GameIcon src={unitIconUrl(unit, view)} label={unit} size={16} />;

  return (
    <Panel index={6} title={t('spending.title')} className="panel-spending" aside={<span className="badge badge-warn">{t('spending.badge')}</span>}>
      <div className="segmented segmented-wide" role="tablist" aria-label={t('spending.tabs')}>
        <button type="button" role="tab" aria-selected={tab === 'costs'} aria-pressed={tab === 'costs'} onClick={() => setTab('costs')}>
          {t('spending.costs')}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'prices'} aria-pressed={tab === 'prices'} onClick={() => setTab('prices')}>
          {t('spending.prices')}
          {props.pricesAreMock ? ` ${t('spending.mock')}` : ''}
        </button>
      </div>

      {tab === 'prices' ? (
        <PriceEditor view={view} priceInputs={props.priceInputs} onPrice={props.onPrice} />
      ) : (
        <>
          <h3 className="sub-head">{t('spending.spentHead')}</h3>
          {props.hasManualEdits && (
            <p className="state-box state-warn spent-manual" role="note">
              <Icon name="alert" size={14} />
              <span>{t('spending.manualWarning')}</span>
            </p>
          )}
          {props.spentLines.length === 0 ? (
            <p className="empty small">{t('spending.nothing')}</p>
          ) : (
            <table className="table compact spent-table">
              <thead>
                <tr>
                  <th>{t('spending.col.consumable')}</th>
                  <th className="right">{t('spending.col.qty')}</th>
                  <th className="right">{t('spending.col.total')}</th>
                </tr>
              </thead>
              <tbody>
                {props.spentLines.map((line) => {
                  const c = view.getConsumable(line.consumableId);
                  return (
                    <tr key={line.consumableId}>
                      <td>
                        <span className="unit">
                          <GameIcon src={consumableIconUrl(c)} label={c?.name ?? line.consumableId} size={18} />
                          {c?.name ?? line.consumableId}
                        </span>
                      </td>
                      <td className="num right">{line.quantity}</td>
                      <td className="num right">
                        {formatCost(line.total, spent.unit ?? unit)}
                        {line.unpriced && <span className="bad" title={t('spending.unpriced')}> *</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="money-row">
            <div className="money money-fact">
              <span className="money-label">{t('spending.spentTotal')}</span>
              <span className="money-value num">
                {formatCost(spent.total, spent.unit ?? unit)} {unitIcon}
              </span>
              <span className="money-note">
                {t('spending.steps', { count: spent.stepCount })}
                {spent.incomplete && ` · ${t('spending.notAllPriced')}`}
              </span>
            </div>
            <div className="money money-est">
              <span className="money-label">{t('spending.nextClick')}</span>
              <span className="money-value num">{attemptCost ? formatCost(attemptCost.total, attemptCost.unit) : '—'}</span>
              <span className="money-note">{t('spending.estimate')}</span>
            </div>
          </div>

          <h3 className="sub-head">{t('spending.stageHead')}</h3>
          <label className="field">
            <span className="field-label">{t('spending.stageTarget')}</span>
            <select name="stage-target" value={props.stageTargetKey ?? ''} onChange={(e) => props.onStageTarget(e.target.value)}>
              {props.stageTargets.some((o) => o.origin === 'target-item') && (
                <optgroup label={t('spending.missingGroup')}>
                  {props.stageTargets
                    .filter((o) => o.origin === 'target-item')
                    .map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.target.label}
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label={t('spending.catalogGroup')}>
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
          <dl className="stage-facts">
            <div>
              <dt>{t('spending.chance')}</dt>
              <dd className="num accent-blue">
                {probability?.status === 'ok'
                  ? formatPercent(probability.probability)
                  : probability?.status === 'already-satisfied'
                    ? t('spending.already')
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('spending.attempts')}</dt>
              <dd className="num">{probability?.status === 'ok' ? formatAttempts(probability.expectedAttempts, intl) : '—'}</dd>
            </div>
            <div className="stage-cost">
              <dt>{t('spending.expectedCost')}</dt>
              <dd className="num accent">{stageCost ? `~ ${formatCost(stageCost.expectedCost, unit)}` : '—'}</dd>
            </div>
          </dl>
          {stageCost && (
            <details className="quantiles">
              <summary>{t('spending.spread')}</summary>
              <table className="table compact">
                <thead>
                  <tr>
                    <th>{t('spending.col.share')}</th>
                    <th className="right">{t('spending.col.clicks')}</th>
                    <th className="right">{t('spending.col.atMost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stageCost.quantiles.map((q) => (
                    <tr key={q.quantile}>
                      <td className="num">{formatQuantile(q.quantile)}</td>
                      <td className="num right">{formatAttempts(q.attempts, intl)}</td>
                      <td className="num right">{formatCost(q.cost, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">{t('spending.model')}</p>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}

function PriceEditor(props: { view: CraftDbView; priceInputs: PriceInputs; onPrice: (id: string, text: string) => void }) {
  const { t } = useI18n();
  const { modelled } = toolPalette(props.view);
  const consumables = [...props.view.listConsumables()].sort((a, b) => Number(modelled.has(b.id)) - Number(modelled.has(a.id)));
  return (
    <div className="price-list">
      {consumables.map((c) => (
        <label key={c.id} className="price-row">
          <GameIcon src={consumableIconUrl(c)} label={c.name} size={22} />
          <span className="price-name">
            {c.name}
            {!modelled.has(c.id) && <span className="muted"> · {t('spending.notModelled')}</span>}
          </span>
          <input
            name={`price-${c.id}`}
            className="num-input"
            inputMode="decimal"
            value={props.priceInputs[c.id] ?? ''}
            placeholder={t('spending.pricePlaceholder')}
            onChange={(e) => props.onPrice(c.id, e.target.value)}
          />
          <span className="muted small">div</span>
        </label>
      ))}
    </div>
  );
}
