import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ExplanationStep } from '@poe2-craft/probability-engine';
import { INTL_LOCALE } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { formatAttempts, formatInt, formatPercent } from '@/lib/format';
import { caveatText, confidenceLabel, exclusionTitle, exclusionsText, issueText, rarityLabel } from '@/lib/texts';
import { Panel } from './Panel';

interface ExplanationPanelProps {
  readonly steps: readonly ExplanationStep[];
  readonly view: CraftDbView;
}

export function ExplanationPanel({ steps, view }: ExplanationPanelProps) {
  const { t } = useI18n();
  return (
    <Panel title={t('why.title')}>
      {steps.length === 0 ? (
        <p className="empty">{t('why.empty')}</p>
      ) : (
        <ol className="why">
          {steps.map((step, i) => (
            <li key={i} className={step.code === 'caveat' ? 'why-caveat' : undefined}>
              <Step step={step} view={view} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Step({ step, view }: { step: ExplanationStep; view: CraftDbView }) {
  const { t, locale } = useI18n();
  const intl = INTL_LOCALE[locale];
  switch (step.code) {
    case 'compound-action': return <span>{t('prob.compound')}</span>;
    case 'dataset':
      return (
        <>
          <b>{t('why.datasetLabel')}</b>{' '}
          {t('why.dataset', {
            title: step.title,
            kind: t(step.kind === 'fixture' ? 'why.kind.fixture' : 'why.kind.production'),
            version: step.gameVersion,
          })}
        </>
      );
    case 'blocked':
      return (
        <>
          <b>{t('why.blockedLabel')}</b> {step.issues.map((issue) => issueText(t, issue)).join(' ')}
        </>
      );
    case 'item':
      return (
        <>
          <b>{t('why.itemLabel')}</b>{' '}
          {t('why.item', {
            base: step.baseName,
            rarity: rarityLabel(t, step.rarity),
            ilvl: step.itemLevel,
            tags: step.baseTags.join(', '),
          })}
        </>
      );
    case 'affix-slots':
      return (
        <>
          <b>{t('why.slotsLabel')}</b>{' '}
          {t('why.slots', {
            pu: step.slots.prefix.used,
            pm: step.slots.prefix.max,
            pf: step.slots.prefix.free,
            su: step.slots.suffix.used,
            sm: step.slots.suffix.max,
            sf: step.slots.suffix.free,
          })}
          {step.slots.unknownSide > 0 && ` ${t('why.unknownSide', { count: step.slots.unknownSide })}`} {t('why.fracturedSlot')}
        </>
      );
    case 'occupied-groups':
      return step.occupants.length === 0 ? (
        <>
          <b>{t('why.groupsLabel')}</b> {t('why.noGroups')}
        </>
      ) : (
        <>
          <b>{t('why.occupiedLabel')}</b> {t('why.occupied')}{' '}
          {step.occupants.map((o, i) => (
            <span key={i} className="inline-item">
              «{view.getGroup(o.groupId)?.name ?? o.groupId}» ← {o.sourceText}
              {o.fractured && ' (fractured)'}
              {o.inferred && ` ${t('why.byUnresolved')}`}
            </span>
          ))}
        </>
      );
    case 'action':
      return (
        <>
          <b>{t('why.actionLabel')}</b>{' '}
          {t('why.action', {
            name: step.name,
            sides: step.allowedSides.map((s) => t(s === 'prefix' ? 'why.sidePrefix' : 'why.sideSuffix')).join(t('why.or')),
            minLevel: step.minModifierLevel !== null ? t('why.minLevel', { level: step.minModifierLevel }) : '',
          })}
        </>
      );
    case 'target':
      return (
        <>
          <b>{t('why.targetLabel', { label: step.label })}</b>{' '}
          {step.entries.map((e) => (
            <span key={e.definition.id} className="inline-item">
              {e.definition.name} T{e.tier}:{' '}
              {e.eligible
                ? t('why.inPool', { weight: e.weight === null ? t('why.weightUnknown') : formatInt(e.weight, intl) })
                : t('why.excluded', { reasons: exclusionsText(t, e.reasons, view) })}
            </span>
          ))}
          {step.missingModifierIds.length > 0 && ` ${t('why.missingInVersion', { ids: step.missingModifierIds.join(', ') })}`}
        </>
      );
    case 'pool-summary':
      return (
        <>
          <b>{t('why.poolLabel')}</b> {t('why.pool', { considered: step.consideredCount, eligible: step.eligibleCount })}{' '}
          {Object.entries(step.excludedByReason).map(([code, count]) => (
            <span key={code} className="inline-item">
              {exclusionTitle(t, code as Parameters<typeof exclusionTitle>[1])} — {count}
            </span>
          ))}
          . {t('why.poolTail')}
        </>
      );
    case 'formula':
      return (
        <>
          <b>{t('why.formulaLabel')}</b>{' '}
          {t('why.formula', {
            tw: formatInt(step.targetWeight, intl),
            pw: formatInt(step.totalWeight, intl),
            p: formatPercent(step.probability),
            attempts: formatAttempts(step.expectedAttempts, intl),
            confidence: confidenceLabel(t, step.confidence),
          })}
        </>
      );
    case 'already-satisfied':
      return (
        <>
          <b>{t('why.alreadyLabel')}</b> {step.modifierIds.join(', ')}.
        </>
      );
    case 'target-weight-unknown':
      return (
        <>
          <b>{t('why.weightUnknownLabel')}</b> {t('why.weightUnknownText', { ids: step.modifierIds.join(', ') })}
        </>
      );
    case 'caveat':
      return (
        <>
          <b>{t('why.caveatLabel')}</b> {caveatText(t, step.caveat)}
        </>
      );
  }
}
