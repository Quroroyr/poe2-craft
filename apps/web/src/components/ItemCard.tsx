import type { ReactNode } from 'react';
import type { AffixSide, ExplicitModifier, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { baseArt } from '@/lib/icons';
import type { ModBadge } from '@/lib/session-ui';
import { RARITY_LABEL, SIDE_LABEL, SIDE_SHORT, SLOT_LABEL, UNRESOLVED_LABEL } from '@/lib/texts';
import { Icon } from './Icon';
import { ItemArt } from './ItemArt';

interface ItemCardProps {
  readonly item: ItemState;
  readonly view: CraftDbView;
  /**
   * - hero: the crafting object — name, art, quality / item level / slots, then affixes;
   * - setup: affix blocks only, the panel around it shows the base and its settings.
   */
  readonly variant: 'hero' | 'setup';
  /** Badge per index in `item.explicits` (e.g. "new" for simulated modifiers, target status). */
  readonly badges?: ReadonlyMap<number, ModBadge>;
  /** Index of the modifier the last click added; it gets a short highlight. */
  readonly freshIndex?: number | null;
  /** Problems of a modifier at an index (e.g. its tier needs a higher item level). */
  readonly issues?: ReadonlyMap<number, string>;
  /** Extra controls under a modifier line (used by the editable source). */
  readonly renderModActions?: (index: number, mod: ExplicitModifier) => ReactNode;
  /** Extra controls at the end of a side block (e.g. "+ Add prefix"). */
  readonly renderSideFooter?: (side: AffixSide, used: number, max: number | undefined) => ReactNode;
}

/** An item in PoE semantics — rarity colour, implicit / prefix / suffix blocks, fractured lines — as a web tool. */
export function ItemCard(props: ItemCardProps) {
  const { item, view, variant, badges } = props;
  const base = item.baseId ? view.getBase(item.baseId) : undefined;
  const itemClass = base ? view.getItemClass(base.itemClassId) : undefined;
  const limits = item.rarity ? view.getAffixLimits(item.rarity) : undefined;
  const indexed = item.explicits.map((mod, index) => ({ mod, index }));
  const sideOf = (m: ExplicitModifier): AffixSide | null =>
    m.kind === 'resolved' ? (view.getModifier(m.modifierId)?.side ?? null) : null;
  const unresolved = indexed.filter(({ mod }) => sideOf(mod) === null);
  const itemImplicits = item.otherLines.filter((l) => l.source === 'implicit').map((l) => l.text);
  const implicits = itemImplicits.length > 0 ? itemImplicits : (base?.details?.implicits ?? []);

  const renderMod = ({ mod, index }: { mod: ExplicitModifier; index: number }) => (
    <li key={index} className="mod-item">
      <ModLine
        mod={mod}
        view={view}
        badge={badges?.get(index)}
        fresh={props.freshIndex === index}
        issue={props.issues?.get(index)}
      />
      {props.renderModActions?.(index, mod)}
    </li>
  );

  return (
    <article className={`item item-${variant} rarity-${item.rarity ?? 'unknown'}`}>
      {variant === 'hero' && (
        <header className="item-head">
          <div className="item-name">{item.baseName ?? 'База не распознана'}</div>
          <div className="item-sub">
            {itemClass?.name ?? item.itemClassName ?? 'Класс ?'} · {item.rarity ? RARITY_LABEL[item.rarity] : 'редкость ?'}
            {!item.baseId && <span className="bad"> · нет в CraftDB</span>}
          </div>
        </header>
      )}
      <div className="item-body">
        {variant === 'hero' && (
          <div className="item-visual">
            <div className="item-stage">
              <ItemArt art={baseArt(base)} label={item.baseName ?? 'предмет'} maxHeight={188} />
            </div>
            <dl className="item-meta">
              <div>
                <dt>Item Level</dt>
                <dd className="num">{item.itemLevel ?? '?'}</dd>
              </div>
              {item.quality !== null && (
                <div>
                  <dt>Качество</dt>
                  <dd className="num">+{item.quality}%</dd>
                </div>
              )}
              {item.slots.map((slot) => (
                <div key={slot.kind}>
                  <dt>{SLOT_LABEL[slot.kind] ?? slot.kind}</dt>
                  <dd className="num">{slot.count}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="item-affixes">
          {implicits.length > 0 && (
            <section className="affix-block affix-implicit" aria-label="Implicit">
              {implicits.map((line) => (
                <p key={line} className="implicit-line">
                  {line}
                </p>
              ))}
            </section>
          )}

          {(['prefix', 'suffix'] as const).map((side) => {
            const mods = indexed.filter(({ mod }) => sideOf(mod) === side);
            const max = side === 'prefix' ? limits?.maxPrefixes : limits?.maxSuffixes;
            return (
              <section className="affix-block" key={side} aria-label={`${SIDE_LABEL[side]}ы`}>
                <h3 className="affix-title">
                  {SIDE_LABEL[side]}ы
                  <SlotPips used={mods.length} max={max} />
                </h3>
                {mods.length === 0 && !props.renderSideFooter && <p className="affix-empty">пусто</p>}
                {mods.length > 0 && <ul className="mod-list">{mods.map(renderMod)}</ul>}
                {props.renderSideFooter?.(side, mods.length, max)}
              </section>
            );
          })}

          {unresolved.length > 0 && (
            <section className="affix-block" aria-label="Нераспознанные строки">
              <h3 className="affix-title bad">Нераспознанные строки</h3>
              <ul className="mod-list">{unresolved.map(renderMod)}</ul>
            </section>
          )}
        </div>
      </div>
    </article>
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

/** The tag shows the fractured state, so a copied "(fractured)" annotation is not repeated in the text. */
const displayText = (text: string) => text.replace(/\s*\(fractured\)\s*$/i, '');

function ModLine(props: {
  mod: ExplicitModifier;
  view: CraftDbView;
  badge: ModBadge | undefined;
  fresh: boolean;
  issue: string | undefined;
}) {
  const { mod, badge } = props;
  const badgeEl = badge && <span className={`tag tag-${badge.tone}`}>{badge.label}</span>;
  const fractured = mod.fractured && (
    <span className="tag tag-fractured">
      <Icon name="crack" size={12} />
      fractured
    </span>
  );
  if (mod.kind === 'unresolved') {
    return (
      <div className="mod-line mod-unresolved">
        <span className="mod-text">{displayText(mod.sourceText)}</span>
        <span className="mod-meta">
          {UNRESOLVED_LABEL[mod.reason]}
          {fractured}
          {badgeEl}
        </span>
      </div>
    );
  }
  const def = props.view.getModifier(mod.modifierId);
  const classes = ['mod-line', mod.fractured && 'mod-fractured', badge?.tone === 'new' && 'mod-new', props.fresh && 'mod-fresh']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <span className="mod-text">{displayText(mod.sourceText)}</span>
      <span className="mod-meta">
        {def ? (
          <span className="mod-tier">
            <abbr title={SIDE_LABEL[def.side]}>{SIDE_SHORT[def.side]}</abbr>
            <b>T{def.tier}</b> {def.name}
          </span>
        ) : (
          mod.modifierId
        )}
        {fractured}
        {badgeEl}
      </span>
      {props.issue && <span className="mod-issue">{props.issue}</span>}
    </div>
  );
}
