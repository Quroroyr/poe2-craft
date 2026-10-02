import type { BaseRequirements, ItemBase } from '@poe2-craft/craft-domain';
import { baseArt } from '@/lib/icons';
import { PROPERTY_LABEL } from '@/lib/texts';
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

const REQ_ORDER = [
  ['level', 'Уровень'],
  ['strength', 'Str'],
  ['dexterity', 'Dex'],
  ['intelligence', 'Int'],
] as const;

export function requirementsText(requirements: BaseRequirements | undefined): string | null {
  if (!requirements) return null;
  const parts = REQ_ORDER.flatMap(([key, label]) => {
    const value = requirements[key];
    return value === undefined ? [] : [`${label} ${value}`];
  });
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Base properties as the base has them before any modifier. Modifiers and quality are not applied
 * to these numbers (no verified rule yet), and the block says so.
 */
export function BaseStats({ base }: { base: ItemBase | undefined }) {
  const details = base?.details;
  if (!details) return null;
  const requirements = requirementsText(details.requirements);
  return (
    <div className="base-stats">
      <dl>
        {details.properties.map((p) => (
          <div key={p.name}>
            <dt>{PROPERTY_LABEL[p.name] ?? p.name}:</dt>
            <dd className="num">{p.value}</dd>
          </div>
        ))}
      </dl>
      <p className="base-req">Требуется: {requirements ?? 'нет требований'}</p>
      <p className="base-note" title="Свойства базы без учёта модов и качества: их влияние на числа пока не моделируется">
        значения базы, без модов
      </p>
    </div>
  );
}
