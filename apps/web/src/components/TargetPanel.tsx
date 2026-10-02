import { modifierText, removeRequirement, setRequirementTier, type TargetSpec } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { familyTiers, type TargetBaseCheck, type TargetOutlook, type TargetOutlookRow } from '@poe2-craft/craft-session';
import { useI18n } from '@/i18n/I18nProvider';
import type { ExplorerMode } from '@/lib/analyze';
import { exclusionsText, rarityLabel, targetStateLabel } from '@/lib/texts';
import { Icon } from './Icon';
import { ArtFrame, BaseStats } from './ItemBits';
import { ModMoreButton } from './ModMoreButton';
import { Panel } from './Panel';

interface TargetPanelProps {
  readonly target: TargetSpec | null;
  readonly outlook: TargetOutlook | null;
  readonly view: CraftDbView;
  readonly explorerMode: ExplorerMode;
  readonly baseCheck: TargetBaseCheck;
  readonly sourceBaseName: string | null;
  /** A current item exists: building a target or copying the current one is possible. */
  readonly hasItem: boolean;
  readonly onEdit: (target: TargetSpec | null) => void;
  /** An empty target on the current item's base, then the pool to add requirements. */
  readonly onBuild: () => void;
  /** Opens the shared import dialog for the target. */
  readonly onImport: () => void;
  /** Same base and item level as the current item; its modifiers become "tier N or better" requirements. */
  readonly onCopyCurrent: () => void;
  readonly onExplore: (mode: ExplorerMode) => void;
  /** Opens the context menu of a requirement. */
  readonly onModMenu: (requirementId: string, x: number, y: number) => void;
  readonly menuRequirementId: string | null;
}

/**
 * The target: always on the main screen, next to the current item. Requirements are "family at
 * tier N or better", each with its state on the current item (computed in craft-session).
 */
export function TargetPanel(props: TargetPanelProps) {
  const { target, outlook, view } = props;
  const { t } = useI18n();
  const base = target?.baseId ? view.getBase(target.baseId) : undefined;
  const itemClass = base ? view.getItemClass(base.itemClassId) : undefined;
  const limits = view.getAffixLimits('rare', base?.itemClassId);
  const sideCount = (side: 'prefix' | 'suffix') =>
    target?.requirements.filter((r) => view.getModifier(r.modifierId)?.side === side).length ?? 0;

  return (
    <Panel
      index={2}
      title={t('target.title')}
      className="panel-target"
      aside={
        target ? (
          <>
            <button type="button" className="btn btn-small" onClick={props.onImport}>
              <Icon name="import" size={14} />
              {t('target.import')}
            </button>
            <button type="button" className="btn btn-small" onClick={() => props.onEdit(null)}>
              <Icon name="reset" size={14} />
              {t('target.clear')}
            </button>
          </>
        ) : undefined
      }
    >
      {!target ? (
        <TargetEmpty {...props} />
      ) : (
        <>
          <div className="target-top">
            <ArtFrame base={base} label={target.baseName ?? t('target.artLabel')} glow="frost" maxHeight={150} className="target-art" />
            <div className="target-info">
              <h3 className="item-name rarity-name-rare">{target.baseName ?? t('target.baseFallback')}</h3>
              <p className="item-sub">
                <span className="rarity-text">{t('item.rarityLine', { rarity: rarityLabel(t, 'rare') })}</span> · ilvl{' '}
                {target.itemLevel ?? '—'}
              </p>
              <div className="tag-row">
                {itemClass && <span className="tag">{itemClass.name}</span>}
                <span className="tag">{t('target.tierRequirements')}</span>
              </div>
              <BaseStats base={base} />
            </div>
          </div>

          {props.baseCheck === 'mismatch' && (
            <div className="state-box state-bad target-mismatch" role="alert">
              <strong>{t('target.mismatchTitle')}</strong>
              <span>{t('target.mismatchText', { target: target.baseName ?? '?', source: props.sourceBaseName ?? '?' })}</span>
              <button type="button" className="btn btn-small" onClick={props.onBuild}>
                {t('target.newFor', { base: props.sourceBaseName ?? t('target.newForFallback') })}
              </button>
            </div>
          )}

          <div className="target-mods-head">
            <span>
              {t('target.mods')}{' '}
              <b className="num">
                {outlook?.done ?? 0} / {target.requirements.length}
              </b>
            </span>
            <span className="muted">{t('target.compare')}</span>
          </div>
          {target.requirements.length === 0 ? (
            <p className="empty small">{t('target.noRequirements')}</p>
          ) : (
            <ul className="target-rows">
              {target.requirements.map((req) => (
                <TargetRow
                  baseId={target.baseId}
                  key={req.id}
                  row={outlook?.rows.find((r) => r.comparison.requirement.id === req.id)}
                  modifierId={req.modifierId}
                  requirementId={req.id}
                  fractured={req.fractured}
                  view={view}
                  onTier={(modifierId) => props.onEdit(setRequirementTier(target, req.id, modifierId))}
                  onRemove={() => props.onEdit(removeRequirement(target, req.id))}
                  menuOpen={props.menuRequirementId === req.id}
                  onMenu={(x, y) => props.onModMenu(req.id, x, y)}
                />
              ))}
            </ul>
          )}
          <div className="target-add">
            {(['prefix', 'suffix'] as const).map((side) => {
              const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
              const active = props.explorerMode.kind === 'edit-target' && props.explorerMode.side === side;
              return (
                <button
                  key={side}
                  type="button"
                  className={`add-btn${active ? ' add-btn-active' : ''}`}
                  aria-label={t(side === 'prefix' ? 'target.addPrefixLabel' : 'target.addSuffixLabel')}
                  disabled={max !== undefined && sideCount(side) >= max}
                  onClick={() => props.onExplore({ kind: 'edit-target', side })}
                >
                  <Icon name="plus" size={14} />
                  {t(side === 'prefix' ? 'target.addPrefix' : 'target.addSuffix')}
                </button>
              );
            })}
          </div>
          {target.unresolvedLines.length > 0 && (
            <p className="hint">{t('target.unresolved', { lines: target.unresolvedLines.join('; ') })}</p>
          )}

          {outlook && outlook.total > 0 && (
            <div className="target-progress">
              <span>
                {t('target.progress')}{' '}
                <b className="num">
                  {outlook.done} / {outlook.total}
                </b>{' '}
                {t('target.progressUnit', { count: outlook.total })}
              </span>
              <span
                className="progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={outlook.total}
                aria-valuenow={outlook.done}
                aria-label={t('target.progressAria')}
              >
                <span style={{ transform: `scaleX(${outlook.ratio ?? 0})` }} />
              </span>
              <b className="num">{Math.round((outlook.ratio ?? 0) * 100)} %</b>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** No target yet: what a target gives, and the three ways to set one. */
function TargetEmpty(props: TargetPanelProps) {
  const { t } = useI18n();
  return (
    <div className="target-empty">
      <h3 className="target-empty-title">{t('target.emptyTitle')}</h3>
      <p>{t('target.emptyLead')}</p>
      <ul className="target-empty-list">
        <li>{t('target.emptyProgress')}</li>
        <li>{t('target.emptyMissing')}</li>
        <li>{t('target.emptyChances')}</li>
        <li>{t('target.emptyCost')}</li>
      </ul>
      <div className="target-empty-actions">
        <button type="button" className="btn btn-primary" disabled={!props.hasItem} onClick={props.onBuild} title={props.hasItem ? t('target.buildHint') : t('target.needItem')}>
          <Icon name="plus" size={14} />
          {t('target.build')}
        </button>
        <button type="button" className="btn" onClick={props.onImport}>
          <Icon name="import" size={14} />
          {t('target.importTarget')}
        </button>
        <button type="button" className="btn" disabled={!props.hasItem} onClick={props.onCopyCurrent} title={props.hasItem ? undefined : t('target.needItem')}>
          <Icon name="target" size={14} />
          {t('target.copyCurrent')}
        </button>
      </div>
      <p className="hint">{props.hasItem ? t('target.copyCurrentHint') : t('target.needItem')}</p>
    </div>
  );
}

function TargetRow(props: {
  baseId: string | null;
  row: TargetOutlookRow | undefined;
  requirementId: string;
  modifierId: string;
  fractured: boolean;
  view: CraftDbView;
  onTier: (modifierId: string) => void;
  onRemove: () => void;
  menuOpen: boolean;
  onMenu: (x: number, y: number) => void;
}) {
  const { t } = useI18n();
  const def = props.view.getModifier(props.modifierId);
  const state = props.row?.state ?? 'unknown';
  const current = props.row?.comparison.current;
  const reasonText =
    state === 'missing'
      ? props.fractured
        ? t('target.reasonFractured')
        : exclusionsText(t, props.row?.reasons ?? [], props.view)
      : state === 'worse-tier'
        ? t('target.reasonWorse', { tier: current ? props.view.tierOf(current.modifierId, props.baseId) : '?' })
        : state === 'not-fractured'
          ? t('target.reasonNotFractured')
          : undefined;

  return (
    <li
      className={`target-row state-${state}${props.menuOpen ? ' is-menu-open' : ''}`}
      onContextMenu={(e) => {
        if (e.target instanceof HTMLSelectElement) return;
        e.preventDefault();
        props.onMenu(e.clientX, e.clientY);
      }}
    >
      <span className="state-dot" aria-hidden />
      <span className="target-text">
        <span className="mod-text">{def ? modifierText(def) : props.modifierId}</span>
        {props.fractured && (
          <span className="tag tag-fractured">
            <Icon name="crack" size={11} />
            {t('tag.fractured')}
          </span>
        )}
      </span>
      {def ? (
        <select
          name={`req-tier-${props.requirementId}`}
          className="tier-select"
          aria-label={t('target.minTier')}
          value={def.id}
          onChange={(e) => props.onTier(e.target.value)}
        >
          {familyTiers(props.view, def, props.baseId).map((tier) => (
            <option key={tier.id} value={tier.id}>
              {props.view.tierOf(tier.id, props.baseId) === 1 ? 'T1' : `T${props.view.tierOf(tier.id, props.baseId)}+`}
            </option>
          ))}
        </select>
      ) : (
        <span className="tier-badge">—</span>
      )}
      <span className={`state-pill pill-${state}`} title={reasonText}>
        {targetStateLabel(t, state)}
      </span>
      <span className="target-now num" title={current?.sourceText}>
        {current ? (currentNumbers(current.sourceText) ?? t('target.present')) : '—'}
      </span>
      <ModMoreButton label={t('target.actions')} open={props.menuOpen} onMenu={props.onMenu} />
      <button type="button" className="icon-btn icon-btn-quiet" aria-label={t('target.removeRequirement')} onClick={props.onRemove}>
        <Icon name="close" size={13} />
      </button>
    </li>
  );
}

/** The rolled numbers of a modifier line, e.g. "+3.81%" or "16–28", for the compact comparison column. */
function currentNumbers(text: string): string | null {
  const numbers = text.replace(/\s*\(fractured\)$/i, '').match(/[+-]?\d+(\.\d+)?%?/g);
  return numbers ? numbers.join('–') : null;
}
