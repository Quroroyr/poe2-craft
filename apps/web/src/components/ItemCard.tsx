import type { ReactNode } from 'react';
import type { AffixSide, ExplicitModifier, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ModBadge } from '@/lib/session-ui';
import { RARITY_LABEL, SIDE_LABEL, UNRESOLVED_LABEL } from '@/lib/texts';

interface ItemCardProps {
  readonly item: ItemState;
  readonly view: CraftDbView;
  readonly name?: string | null;
  readonly size?: 'compact' | 'large';
  /** Badge per index in `item.explicits` (e.g. "new" for simulated modifiers, target status). */
  readonly badges?: ReadonlyMap<number, ModBadge>;
  /** Extra controls under a modifier line (used by the editable source). */
  readonly renderModActions?: (index: number, mod: ExplicitModifier) => ReactNode;
  /** Extra controls at the end of a side block (e.g. "+ Add prefix"). */
  readonly renderSideFooter?: (side: AffixSide, used: number, max: number | undefined) => ReactNode;
}

/** Item rendered like an in-game tooltip, split into prefix / suffix / unresolved blocks. */
export function ItemCard(props: ItemCardProps) {
  const { item, view, name, size = 'compact', badges } = props;
  const limits = item.rarity ? view.getAffixLimits(item.rarity) : undefined;
  const indexed = item.explicits.map((mod, index) => ({ mod, index }));
  const sideOf = (m: ExplicitModifier): AffixSide | null =>
    m.kind === 'resolved' ? (view.getModifier(m.modifierId)?.side ?? null) : null;
  const bySide = (side: AffixSide) => indexed.filter(({ mod }) => sideOf(mod) === side);
  const unresolved = indexed.filter(({ mod }) => sideOf(mod) === null);

  return (
    <div className={`tooltip tooltip-${size} rarity-${item.rarity ?? 'unknown'}`}>
      <div className="tooltip-head">
        {name && <div className="tooltip-name">{name}</div>}
        <div className="tooltip-base">{item.baseName ?? 'База не распознана'}</div>
        <div className="tooltip-sub">
          {item.rarity ? RARITY_LABEL[item.rarity] : 'Редкость ?'} · ilvl {item.itemLevel ?? '?'}
          {!item.baseId && <span className="bad"> · нет в CraftDB</span>}
        </div>
      </div>

      {(['prefix', 'suffix'] as const).map((side) => {
        const mods = bySide(side);
        const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
        return (
          <div className="affix-block" key={side}>
            <div className="affix-title">
              {SIDE_LABEL[side]}ы
              <SlotPips used={mods.length} max={max} />
            </div>
            {mods.length === 0 && <div className="affix-empty">пусто</div>}
            {mods.map(({ mod, index }) => (
              <div key={index}>
                <ModLine mod={mod} view={view} badge={badges?.get(index)} />
                {props.renderModActions?.(index, mod)}
              </div>
            ))}
            {props.renderSideFooter?.(side, mods.length, max)}
          </div>
        );
      })}

      {unresolved.length > 0 && (
        <div className="affix-block">
          <div className="affix-title bad">Нераспознанные строки</div>
          {unresolved.map(({ mod, index }) => (
            <div key={index}>
              <ModLine mod={mod} view={view} badge={badges?.get(index)} />
              {props.renderModActions?.(index, mod)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotPips({ used, max }: { used: number; max: number | undefined }) {
  if (max === undefined) return <span className="num muted"> {used}</span>;
  return (
    <span className="pips" aria-label={`${used} из ${max}`}>
      {Array.from({ length: Math.max(max, used) }, (_, i) => (
        <span key={i} className={`pip${i < used ? ' pip-on' : ''}${i >= max ? ' pip-over' : ''}`} />
      ))}
      <span className="num muted">
        {used}/{max}
      </span>
    </span>
  );
}

function ModLine({ mod, view, badge }: { mod: ExplicitModifier; view: CraftDbView; badge: ModBadge | undefined }) {
  const badgeEl = badge && <span className={`tag tag-${badge.tone}`}>{badge.label}</span>;
  if (mod.kind === 'unresolved') {
    return (
      <div className="mod-line mod-unresolved">
        <span className="mod-text">{mod.sourceText}</span>
        <span className="mod-meta">
          {UNRESOLVED_LABEL[mod.reason]}
          {badgeEl}
        </span>
      </div>
    );
  }
  const def = view.getModifier(mod.modifierId);
  return (
    <div className={`mod-line${mod.fractured ? ' mod-fractured' : ''}${badge?.tone === 'new' ? ' mod-new' : ''}`}>
      <span className="mod-text">{mod.sourceText}</span>
      <span className="mod-meta">
        {def ? `T${def.tier} · ${def.name}` : mod.modifierId}
        {mod.fractured && <span className="tag tag-fractured">fractured</span>}
        {badgeEl}
      </span>
    </div>
  );
}
