import {
  modifierText,
  removeRequirement,
  setRequirementTier,
  type AffixSide,
  type TargetSpec,
} from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { familyTiers, type ItemComparison, type RequirementComparison } from '@poe2-craft/craft-session';
import type { ExplorerMode } from '@/lib/analyze';
import { SIDE_LABEL, TARGET_STATUS_LABEL } from '@/lib/texts';
import { ImportBox } from './ImportBox';
import { Panel } from './Panel';

interface TargetPanelProps {
  readonly target: TargetSpec | null;
  readonly comparison: ItemComparison | null;
  readonly view: CraftDbView;
  readonly explorerMode: ExplorerMode;
  readonly onImport: (text: string) => void;
  readonly onEdit: (target: TargetSpec | null) => void;
  readonly onCreate: () => void;
  readonly onExplore: (mode: ExplorerMode) => void;
}

const TONE: Record<string, string> = {
  matched: 'ok',
  'better-tier': 'ok',
  'worse-tier': 'warn',
  missing: 'bad',
  unknown: 'warn',
};

/** Target builder: requirements "family at tier N or better", imported and/or added by hand. */
export function TargetPanel(props: TargetPanelProps) {
  const { target, comparison, view } = props;
  const rows = comparison?.rows ?? [];
  const rowFor = (id: string) => rows.find((r) => r.requirement.id === id);
  const limits = view.getAffixLimits('rare');

  return (
    <Panel
      title="Цель"
      step="3"
      aside={
        comparison && (
          <span className="badge num" title="Требований выполнено на текущем предмете">
            {comparison.matched}/{comparison.total}
          </span>
        )
      }
    >
      <ImportBox
        id="target-text"
        label="Импорт примера из игры"
        samples={SAMPLE_TARGET_ITEMS}
        onImport={props.onImport}
        defaultOpen={!target}
      />

      {!target ? (
        <div className="blank-form">
          <p className="empty">Цели нет. Импортируйте пример или соберите требования вручную.</p>
          <button type="button" className="btn" onClick={props.onCreate}>
            Собрать цель вручную
          </button>
        </div>
      ) : (
        <div className="target-spec">
          <div className="target-head">
            <span className="target-base">{target.baseName ?? 'База исходного предмета'}</span>
            <span className="muted small">ilvl {target.itemLevel ?? '—'} · требования «тир N или лучше»</span>
          </div>
          {(['prefix', 'suffix'] as const).map((side) => {
            const reqs = target.requirements.filter((r) => view.getModifier(r.modifierId)?.side === side);
            const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
            const active = props.explorerMode.kind === 'edit-target' && props.explorerMode.side === side;
            return (
              <div key={side} className="affix-block">
                <div className="affix-title">
                  {SIDE_LABEL[side]}ы <span className="num muted">{reqs.length}{max !== undefined && `/${max}`}</span>
                </div>
                {reqs.length === 0 && <div className="affix-empty">нет требований</div>}
                {reqs.map((req) => (
                  <RequirementRow
                    key={req.id}
                    row={rowFor(req.id)}
                    requirementId={req.id}
                    modifierId={req.modifierId}
                    fractured={req.fractured}
                    view={view}
                    onTier={(modifierId) => props.onEdit(setRequirementTier(target, req.id, modifierId))}
                    onRemove={() => props.onEdit(removeRequirement(target, req.id))}
                  />
                ))}
                <button
                  type="button"
                  className={`add-btn${active ? ' add-btn-active' : ''}`}
                  disabled={max !== undefined && reqs.length >= max}
                  onClick={() => props.onExplore({ kind: 'edit-target', side: side as AffixSide })}
                >
                  + Требование: {side === 'prefix' ? 'префикс' : 'суффикс'}
                </button>
              </div>
            );
          })}
          {target.unresolvedLines.length > 0 && (
            <div className="affix-block">
              <div className="affix-title bad">Не распознано при импорте (не требования)</div>
              {target.unresolvedLines.map((line, i) => (
                <div key={i} className="mod-line mod-unresolved">
                  <span className="mod-text">{line}</span>
                </div>
              ))}
            </div>
          )}
          {comparison && comparison.extra.length > 0 && (
            <p className="hint">
              Лишнее на текущем: {comparison.extra.map((m) => m.sourceText.replace(/\n/g, ' / ')).join('; ')}
            </p>
          )}
          <button type="button" className="link-btn" onClick={() => props.onEdit(null)}>
            очистить цель
          </button>
        </div>
      )}
    </Panel>
  );
}

function RequirementRow(props: {
  row: RequirementComparison | undefined;
  requirementId: string;
  modifierId: string;
  fractured: boolean;
  view: CraftDbView;
  onTier: (modifierId: string) => void;
  onRemove: () => void;
}) {
  const def = props.view.getModifier(props.modifierId);
  if (!def) {
    return (
      <div className="req-row">
        <span className="bad">{props.modifierId}: нет в этой версии</span>
        <button type="button" className="icon-btn" aria-label="Удалить требование" onClick={props.onRemove}>
          ×
        </button>
      </div>
    );
  }
  const status = props.row?.status;
  return (
    <div className="req-row">
      <div className="req-main">
        <span className="mod-text">{modifierText(def)}</span>
        <span className="req-meta">
          <select
            name={`req-tier-${props.requirementId}`}
            aria-label="Минимальный тир"
            value={def.id}
            onChange={(e) => props.onTier(e.target.value)}
          >
            {familyTiers(props.view, def).map((t) => (
              <option key={t.id} value={t.id}>
                {t.tier === 1 ? 'T1' : `T${t.tier}+`}
              </option>
            ))}
          </select>
          {props.fractured && <span className="tag tag-fractured">fractured</span>}
          {status && <span className={`tag tag-${TONE[status]}`}>{TARGET_STATUS_LABEL[status]}</span>}
          {props.row?.current && status !== 'matched' && (
            <span className="muted small">сейчас T{props.row.currentDefinition?.tier}</span>
          )}
        </span>
      </div>
      <button type="button" className="icon-btn" aria-label="Удалить требование" onClick={props.onRemove}>
        ×
      </button>
    </div>
  );
}
