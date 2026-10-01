import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ProbabilityResult } from '@poe2-craft/probability-engine';
import { CONFIDENCE_LABEL } from '@/lib/texts';
import { Panel } from './Panel';

interface DataPanelProps {
  readonly view: CraftDbView;
  readonly probability: ProbabilityResult | null;
}

export function DataPanel({ view, probability }: DataPanelProps) {
  const info = view.info;
  return (
    <Panel title="Данные" step="11">
      <dl className="data-list">
        <div>
          <dt>Версия игры</dt>
          <dd className="num">{view.gameVersion}</dd>
        </div>
        <div>
          <dt>Набор</dt>
          <dd>
            {info.title} <span className={`badge ${info.kind === 'fixture' ? 'badge-warn' : ''}`}>{info.kind}</span>
          </dd>
        </div>
        <div>
          <dt>Достоверность расчёта</dt>
          <dd>{probability?.status === 'ok' ? CONFIDENCE_LABEL[probability.confidence] : '—'}</dd>
        </div>
        <div>
          <dt>Источники</dt>
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
