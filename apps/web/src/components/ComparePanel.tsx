import type { ItemComparison } from '@poe2-craft/craft-session';
import { TARGET_STATUS_LABEL } from '@/lib/texts';
import { Panel } from './Panel';

interface ComparePanelProps {
  readonly comparison: ItemComparison | null;
  readonly hasTarget: boolean;
}

const TONE: Record<string, string> = {
  matched: 'ok',
  'better-tier': 'ok',
  'worse-tier': 'warn',
  missing: 'bad',
  unknown: 'warn',
};

export function ComparePanel({ comparison, hasTarget }: ComparePanelProps) {
  return (
    <Panel title="Текущий vs целевой" step="7">
      {!comparison ? (
        <p className="empty">
          {hasTarget ? 'Нет текущего предмета для сравнения.' : 'Вставьте целевой предмет справа, чтобы сравнить.'}
        </p>
      ) : (
        <>
          <div className="compare-summary">
            <span className="compare-score num">
              {comparison.matched} / {comparison.total}
            </span>
            <span>модов целевого предмета уже есть</span>
            {comparison.sameBase === false && <span className="tag tag-bad">другая база</span>}
          </div>
          <div className="meter" aria-hidden>
            <span style={{ width: `${comparison.total ? (comparison.matched / comparison.total) * 100 : 0}%` }} />
          </div>
          <ul className="compare-list">
            {comparison.rows.map((row, i) => (
              <li key={i}>
                <span className={`tag tag-${TONE[row.status]}`}>{TARGET_STATUS_LABEL[row.status]}</span>
                <span className="compare-text">{row.target.sourceText}</span>
                {row.current && row.status !== 'matched' && (
                  <span className="muted compare-current">сейчас: {row.current.sourceText}</span>
                )}
              </li>
            ))}
          </ul>
          {comparison.extra.length > 0 && (
            <>
              <h3 className="sub-head">Лишние на текущем</h3>
              <ul className="compare-list">
                {comparison.extra.map((mod, i) => (
                  <li key={i}>
                    <span className="tag">лишний</span>
                    <span className="compare-text">{mod.sourceText}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="hint">
            Сравнение по группе мода и тиру (T1 — лучший). Маршрут до целевого предмета пока не строится.
          </p>
        </>
      )}
    </Panel>
  );
}
