import { useState } from 'react';
import { modifierText, removeRequirement, setRequirementTier, type TargetSpec } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { familyTiers, type TargetBaseCheck, type TargetOutlook, type TargetOutlookRow } from '@poe2-craft/craft-session';
import type { ExplorerMode } from '@/lib/analyze';
import { RARITY_LABEL, TARGET_STATE_LABEL, exclusionText } from '@/lib/texts';
import { ModMoreButton } from './ModMoreButton';
import { Icon } from './Icon';
import { ImportBox } from './ImportBox';
import { ArtFrame, BaseStats } from './ItemBits';
import { Panel } from './Panel';

interface TargetPanelProps {
  readonly target: TargetSpec | null;
  readonly outlook: TargetOutlook | null;
  readonly view: CraftDbView;
  readonly explorerMode: ExplorerMode;
  readonly baseCheck: TargetBaseCheck;
  readonly sourceBaseName: string | null;
  readonly onImport: (text: string) => void;
  readonly onEdit: (target: TargetSpec | null) => void;
  readonly onCreate: () => void;
  readonly onExplore: (mode: ExplorerMode) => void;
  /** Opens the context menu of a requirement. */
  readonly onModMenu: (requirementId: string, x: number, y: number) => void;
  readonly menuRequirementId: string | null;
}

/** Target: requirements "family at tier N or better", each with its state on the current item. */
export function TargetPanel(props: TargetPanelProps) {
  const { target, outlook, view } = props;
  const [importOpen, setImportOpen] = useState(false);
  const base = target?.baseId ? view.getBase(target.baseId) : undefined;
  const itemClass = base ? view.getItemClass(base.itemClassId) : undefined;
  const limits = view.getAffixLimits('rare');
  const sideCount = (side: 'prefix' | 'suffix') =>
    target?.requirements.filter((r) => view.getModifier(r.modifierId)?.side === side).length ?? 0;

  return (
    <Panel
      index={3}
      title="Целевой предмет"
      className="panel-target"
      aside={
        <>
          <button type="button" className="btn btn-small" aria-expanded={importOpen} onClick={() => setImportOpen((o) => !o)}>
            <Icon name="import" size={14} />
            Импорт
          </button>
          <button type="button" className="btn btn-small" onClick={() => props.onEdit(null)} disabled={!target}>
            <Icon name="reset" size={14} />
            Сброс
          </button>
        </>
      }
    >
      {(importOpen || !target) && (
        <ImportBox
          id="target-text"
          label="Пример желаемого предмета (Ctrl+C в игре)"
          samples={SAMPLE_TARGET_ITEMS}
          onImport={(text) => {
            props.onImport(text);
            setImportOpen(false);
          }}
          collapsible={false}
        />
      )}

      {!target ? (
        <div className="source-empty">
          <p>Цели нет. Импортируйте пример или соберите требования вручную.</p>
          <button type="button" className="btn btn-primary" onClick={props.onCreate}>
            Собрать цель
          </button>
        </div>
      ) : (
        <>
          <div className="target-top">
            <ArtFrame base={base} label={target.baseName ?? 'база цели'} glow="frost" maxHeight={150} className="target-art" />
            <div className="target-info">
              <h3 className="item-name rarity-name-rare">{target.baseName ?? 'База исходного предмета'}</h3>
              <p className="item-sub">
                <span className="rarity-text">{RARITY_LABEL.rare} предмет</span> · ilvl {target.itemLevel ?? '—'}
              </p>
              <div className="tag-row">
                {itemClass && <span className="tag">{itemClass.name}</span>}
                <span className="tag">требования «тир N+»</span>
              </div>
              <BaseStats base={base} />
            </div>
          </div>

          {props.baseCheck === 'mismatch' && (
            <div className="state-box state-bad target-mismatch" role="alert">
              <strong>База цели не совпадает с базой исходного</strong>
              <span>
                Цель — {target.baseName ?? '?'}, исходный — {props.sourceBaseName ?? '?'}. Обычным крафтом базу не сменить,
                поэтому шансы к этой цели не считаются.
              </span>
              <button type="button" className="btn btn-small" onClick={props.onCreate}>
                Новая цель для {props.sourceBaseName ?? 'исходного'}
              </button>
            </div>
          )}

          <div className="target-mods-head">
            <span>
              Целевые моды <b className="num">{outlook?.done ?? 0} / {target.requirements.length}</b>
            </span>
            <span className="muted">Сравнение (тек. → цель)</span>
          </div>
          {target.requirements.length === 0 ? (
            <p className="empty small">Требований нет — добавьте их из пула модов.</p>
          ) : (
            <ul className="target-rows">
              {target.requirements.map((req) => (
                <TargetRow
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
                  disabled={max !== undefined && sideCount(side) >= max}
                  onClick={() => props.onExplore({ kind: 'edit-target', side })}
                >
                  <Icon name="plus" size={14} />
                  {side === 'prefix' ? 'Префикс' : 'Суффикс'}
                </button>
              );
            })}
          </div>
          {target.unresolvedLines.length > 0 && (
            <p className="hint">Не распознано при импорте (не требования): {target.unresolvedLines.join('; ')}</p>
          )}

          {outlook && outlook.total > 0 && (
            <div className="target-progress">
              <span>
                Прогресс цели: <b className="num">{outlook.done} / {outlook.total}</b> модов
              </span>
              <span
                className="progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={outlook.total}
                aria-valuenow={outlook.done}
                aria-label="Прогресс цели"
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

function TargetRow(props: {
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
  const def = props.view.getModifier(props.modifierId);
  const state = props.row?.state ?? 'unknown';
  const current = props.row?.comparison.current;
  const reasonText =
    state === 'missing'
      ? props.fractured
        ? 'нужен fractured-мод: обычным добавлением не получить'
        : props.row?.reasons.map((r) => exclusionText(r, props.view)).join('; ')
      : state === 'worse-tier'
        ? `сейчас T${props.row?.comparison.currentDefinition?.tier}`
        : state === 'not-fractured'
          ? 'мод есть, но не fractured'
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
            fractured
          </span>
        )}
      </span>
      {def ? (
        <select
          name={`req-tier-${props.requirementId}`}
          className="tier-select"
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
      ) : (
        <span className="tier-badge">—</span>
      )}
      <span className={`state-pill pill-${state}`} title={reasonText}>
        {TARGET_STATE_LABEL[state]}
      </span>
      <span className="target-now num" title={current?.sourceText}>
        {current ? (currentNumbers(current.sourceText) ?? 'есть') : '—'}
      </span>
      <ModMoreButton label="Действия с требованием" open={props.menuOpen} onMenu={props.onMenu} />
      <button type="button" className="icon-btn icon-btn-quiet" aria-label="Удалить требование" onClick={props.onRemove}>
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
