import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { useI18n } from '@/i18n/I18nProvider';
import { confidenceLabel } from '@/lib/texts';
import { Panel } from './Panel';

interface DataPanelProps {
  readonly view: CraftDbView;
  readonly probability: ProbabilityResult | null;
}

export function DataPanel({ view, probability }: DataPanelProps) {
  const { t } = useI18n();
  const info = view.info;
  return (
    <Panel title={t('data.title')}>
      <dl className="data-list">
        <div>
          <dt>{t('data.gameVersion')}</dt>
          <dd className="num">{view.gameVersion}</dd>
        </div>
        <div>
          <dt>{t('data.dataset')}</dt>
          <dd>
            {info.title} <span className={`badge ${info.kind === 'fixture' ? 'badge-warn' : ''}`}>{info.kind}</span>
          </dd>
        </div>
        <div>
          <dt>{t('data.confidence')}</dt>
          <dd>{probability?.status === 'ok' ? confidenceLabel(t, probability.confidence) : '—'}</dd>
        </div>
        <div>
          <dt>{t('data.sources')}</dt>
          <dd>
            <ul className="sources">
              {info.sources.map((s) => (
                <li key={s.id}>
                  <code>{s.kind}</code> {s.title}
                  {s.url && (
                    <>
                      {' '}
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.url}
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <p className="hint">{info.description}</p>
    </Panel>
  );
}
