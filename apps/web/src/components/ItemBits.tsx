import type { BaseRequirements, ItemBase } from '@poe2-craft/craft-domain';
import type { Translator } from '@/i18n/core';
import { useI18n } from '@/i18n/I18nProvider';
import { baseArt } from '@/lib/icons';
import { propertyLabel } from '@/lib/texts';
import { ItemArt } from './ItemArt';

/**
 * The base's canonical art in a recessed cell with a coloured glow: ember for the source, gold for
 * the current item, cold blue for the target. One base always resolves to the same image.
 */
export function ArtFrame(props: {
  base: ItemBase | undefined;
  label: string;
  glow: 'ember' | 'gold' | 'frost';
  maxHeight: number;
  className?: string;
}) {
  return (
    <div className={`art-frame art-${props.glow}${props.className ? ` ${props.className}` : ''}`}>
      <ItemArt art={baseArt(props.base)} label={props.label} maxHeight={props.maxHeight} />
    </div>
  );
}

const REQ_ORDER = ['level', 'strength', 'dexterity', 'intelligence'] as const;
const REQ_SHORT = { strength: 'Str', dexterity: 'Dex', intelligence: 'Int' } as const;

/** "Level 78, Str 50, Dex 127" — attribute abbreviations are the game's own in every language. */
export function requirementsText(t: Translator, requirements: BaseRequirements | undefined, separator = ', '): string | null {
  if (!requirements) return null;
  const parts = REQ_ORDER.flatMap((key) => {
    const value = requirements[key];
    if (value === undefined) return [];
    return [`${key === 'level' ? t('req.level') : REQ_SHORT[key]} ${value}`];
  });
  return parts.length > 0 ? parts.join(separator) : null;
}

/**
 * Base properties as the base has them before any modifier. Modifiers and quality are not applied
 * to these numbers (no verified rule yet), and the block says so.
 */
export function BaseStats({ base }: { base: ItemBase | undefined }) {
  const { t } = useI18n();
  const details = base?.details;
  if (!details) return null;
  const requirements = requirementsText(t, details.requirements);
  return (
    <div className="base-stats">
      <dl>
        {details.properties.map((p) => (
          <div key={p.name}>
            <dt>{propertyLabel(t, p.name)}:</dt>
            <dd className="num">{p.value}</dd>
          </div>
        ))}
      </dl>
      <p className="base-req">{t('base.requires', { requirements: requirements ?? t('bases.noRequirements') })}</p>
      <p className="base-note" title={t('base.noteTitle')}>
        {t('base.note')}
      </p>
    </div>
  );
}
