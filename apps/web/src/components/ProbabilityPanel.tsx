import type { WeightEvidence } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { INTL_LOCALE } from '@/i18n/core';
import { formatAttempts, formatInt, formatPercent, formatQuantile } from '@/lib/format';
import { useI18n } from '@/i18n/I18nProvider';
import { exclusionsText, issueText, weightSourceNote } from '@/lib/texts';
import { Icon } from './Icon';
import { Panel } from './Panel';

interface ProbabilityPanelProps {
  readonly result: ProbabilityResult | null;
  readonly view: CraftDbView;
}

export function ProbabilityPanel({ result, view }: ProbabilityPanelProps) {
  const { t } = useI18n();
  return (
    <Panel title={t('prob.title')}>
      <ProbabilityBody result={result} view={view} />
    </Panel>
  );
}

function ProbabilityBody({ result, view }: ProbabilityPanelProps) {
  const { t, locale } = useI18n();
  const intl = INTL_LOCALE[locale];
  if (!result) return <p className="empty">{t('prob.pickTarget')}</p>;

  switch (result.status) {
    case 'blocked':
      return (
        <div className="state-box state-bad">
          <p>{t('prob.blocked')}</p>
          <ul>
            {result.issues.map((issue, i) => (
              <li key={i}>{issueText(t, issue)}</li>
            ))}
          </ul>
        </div>
      );
    case 'already-satisfied':
      return (
        <div className="state-box state-ok">
          {t('prob.already', { names: result.modifierIds.map((id) => view.getModifier(id)?.name ?? id).join(', ') })}
        </div>
      );
    case 'indeterminate':
      return (
        <div className="state-box state-warn">
          {result.reason === 'compound-action' ? t('prob.compound') : result.reason === 'partial-weights' ? t('prob.partialWeights', { count: result.modifierIds.length }) : t('prob.indeterminate', { ids: result.modifierIds.join(', ') })}
        </div>
      );
    case 'target-unavailable':
      return (
        <div className="state-box state-bad">
          <p>{t('prob.unavailable')}</p>
          <ul>
            {result.targetEntries.map((e) => (
              <li key={e.definition.id}>
                <b>
                  {e.definition.name} (T{e.tier})
                </b>
                : {exclusionsText(t, e.reasons, view)}
              </li>
            ))}
            {result.missingModifierIds.map((id) => (
              <li key={id}>{t('prob.notInVersion', { id })}</li>
            ))}
          </ul>
        </div>
      );
    case 'ok':
      return (
        <>
          <div className="headline">
            <div className="headline-main">
              <span className="headline-label">{t('prob.chance')}</span>
              <span className="headline-value">
                {formatPercent(result.probability)}
              </span>
              <WeightSource view={view} entries={result.targetEntries} />
            </div>
            <div className="headline-side">
              <span className="headline-label">{t('prob.attempts')}</span>
              <span className="headline-value small">{formatAttempts(result.expectedAttempts, intl)}</span>
            </div>
          </div>
          <p className="formula">
            {t('prob.formula')} <b className="num">{formatInt(result.targetWeight, intl)}</b> /{' '}
            <b className="num">{formatInt(result.totalWeight, intl)}</b>
          </p>

          <div className="two-tables">
            <table className="table compact">
              <caption>{t('prob.cumulative')}</caption>
              <thead>
                <tr>
                  <th>N</th>
                  <th className="right">1 − (1 − P)ᴺ</th>
                </tr>
              </thead>
              <tbody>
                {result.cumulative.map((c) => (
                  <tr key={c.attempts}>
                    <td className="num">{c.attempts}</td>
                    <td className="num right">{formatPercent(c.probability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="table compact">
              <caption>{t('prob.quantiles')}</caption>
              <thead>
                <tr>
                  <th>{t('prob.col.share')}</th>
                  <th className="right">{t('prob.col.attempts')}</th>
                </tr>
              </thead>
              <tbody>
                {result.quantiles.map((q) => (
                  <tr key={q.quantile}>
                    <td className="num">{formatQuantile(q.quantile)}</td>
                    <td className="num right">≤ {formatAttempts(q.attempts, intl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      );
  }
}

/** Small line under a chance: where its weights come from; details in the tooltip. */
export function WeightSource(props: { view: CraftDbView; entries: readonly { readonly weightEvidence?: WeightEvidence }[] }) {
  const { t } = useI18n();
  const note = weightSourceNote(t, props.view, props.entries);
  return note ? (
    <span className="weight-source" title={note.title}>
      <Icon name="book" size={12} /> {note.short}
    </span>
  ) : null;
}
