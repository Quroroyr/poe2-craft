import type { ItemState } from '@poe2-craft/craft-domain';
import { useI18n } from '@/i18n/I18nProvider';
import { rarityLabel } from '@/lib/texts';
import { Icon } from './Icon';

interface StartStripProps {
  readonly source: ItemState | null;
  readonly canReset: boolean;
  readonly onEdit: () => void;
  readonly onReset: () => void;
  readonly onImportAnother: () => void;
}

/**
 * The starting item, folded into one line above the current item. It is still the session's
 * source — edited in its own setup surface, never merged with the current item.
 */
export function StartStrip(props: StartStripProps) {
  const { t } = useI18n();
  const source = props.source;
  if (!source) return null;
  const fractured = source.explicits.filter((m) => m.fractured).length;
  const facts = [
    source.baseName ?? t('current.baseUnknown'),
    source.rarity ? rarityLabel(t, source.rarity) : null,
    `ilvl ${source.itemLevel ?? '?'}`,
    source.quality ? t('strip.quality', { quality: source.quality }) : null,
    t('strip.mods', { count: source.explicits.length }),
    fractured > 0 ? t('strip.fractured', { count: fractured }) : null,
  ].filter((f): f is string => f !== null);

  return (
    <div className="start-strip" role="group" aria-label={t('strip.label')}>
      <span className="start-strip-label">{t('strip.label')}:</span>
      <span className="start-strip-facts">{facts.join(' · ')}</span>
      <span className="start-strip-actions">
        <button type="button" className="btn btn-small" onClick={props.onEdit}>
          <Icon name="pencil" size={13} />
          {t('strip.edit')}
        </button>
        <button type="button" className="btn btn-small" onClick={props.onReset} disabled={!props.canReset}>
          <Icon name="reset" size={13} />
          {t('strip.reset')}
        </button>
        <button type="button" className="btn btn-small" onClick={props.onImportAnother}>
          <Icon name="import" size={13} />
          {t('strip.importAnother')}
        </button>
      </span>
    </div>
  );
}
