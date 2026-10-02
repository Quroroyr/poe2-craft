import { useI18n } from '@/i18n/I18nProvider';
import type { ResolvedArt } from '@/lib/icons';

interface ItemArtProps {
  readonly art: ResolvedArt | null;
  readonly label: string;
  /** Maximum displayed height in px. Art is only ever scaled down from its intrinsic size, never up. */
  readonly maxHeight: number;
  readonly className?: string;
}

/** Inventory art of a base. Without a known image it keeps the same footprint with a quiet placeholder. */
export function ItemArt({ art, label, maxHeight, className }: ItemArtProps) {
  const { t } = useI18n();
  if (!art) {
    return (
      <span className={`item-art item-art-missing ${className ?? ''}`} style={{ height: maxHeight }} aria-hidden>
        {t('art.missing')}
      </span>
    );
  }
  const scale = Math.min(1, maxHeight / art.height);
  const width = Math.round(art.width * scale);
  const height = Math.round(art.height * scale);
  return (
    <span className={`item-art ${className ?? ''}`}>
      {/* Plain <img>: small local PNGs at intrinsic size or smaller; next/image optimisation buys nothing. */}
      <img src={art.src} alt={label} width={width} height={height} draggable={false} />
    </span>
  );
}
