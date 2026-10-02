import { useEffect, useRef } from 'react';
import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ItemParseResult } from '@poe2-craft/item-parser';
import { useI18n } from '@/i18n/I18nProvider';
import { diagnosticText, rarityLabel } from '@/lib/texts';
import { Icon } from './Icon';
import { ArtFrame } from './ItemBits';

interface ImportPreviewProps {
  /** null: closed. Nothing is started until "Start crafting". */
  readonly result: ItemParseResult | null;
  /** A craft is already active: confirming replaces it (the target is kept). */
  readonly replacing: boolean;
  readonly view: CraftDbView;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** What was recognised in the pasted item, before it becomes the starting item of a craft. */
export function ImportPreview(props: ImportPreviewProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const open = props.result !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      // showModal focuses the first control; the main action (or the text box) should have it.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  const item = props.result?.state;
  const base = item?.baseId ? props.view.getBase(item.baseId) : undefined;
  const sideOf = (id: string) => props.view.getModifier(id)?.side;
  const resolved = item?.explicits.filter((m) => m.kind === 'resolved') ?? [];
  const prefixes = resolved.filter((m) => m.kind === 'resolved' && sideOf(m.modifierId) === 'prefix').length;
  const suffixes = resolved.filter((m) => m.kind === 'resolved' && sideOf(m.modifierId) === 'suffix').length;
  const fractured = item?.explicits.filter((m) => m.fractured).length ?? 0;
  const unresolved = (item?.explicits.length ?? 0) - prefixes - suffixes;
  const notes = props.result?.diagnostics.filter((d) => d.code !== 'text-warning') ?? [];

  return (
    <dialog
      ref={ref}
      className="confirm-dialog preview-dialog"
      aria-labelledby="preview-title"
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
    >
      {open && item && (
        <div className="confirm-sheet">
          <h2 id="preview-title">{t(props.replacing ? 'preview.replaceTitle' : 'preview.title')}</h2>
          {props.replacing && <p className="state-box state-warn">{t('preview.replaceText')}</p>}
          <div className="preview-item">
            <ArtFrame base={base} label={item.baseName ?? ''} glow="gold" maxHeight={150} className="preview-art" />
            <div className="preview-info">
              <h3 className={`item-name rarity-name-${item.rarity ?? 'unknown'}`}>{item.baseName ?? t('preview.baseUnknown')}</h3>
              <p className="item-sub">
                {item.rarity ? rarityLabel(t, item.rarity) : t('rarity.unknown')} · ilvl {item.itemLevel ?? '?'}
              </p>
              <ul className="preview-counts">
                <li>{t('preview.prefixes', { count: prefixes })}</li>
                <li>{t('preview.suffixes', { count: suffixes })}</li>
                {fractured > 0 && (
                  <li className="preview-fractured">
                    <Icon name="crack" size={12} /> {t('preview.fractured', { count: fractured })}
                  </li>
                )}
                {unresolved > 0 && <li className="bad">{t('preview.unresolved', { count: unresolved })}</li>}
              </ul>
            </div>
          </div>
          {notes.length > 0 && (
            <ul className="preview-notes">
              {notes.map((d, i) => (
                <li key={i}>{diagnosticText(t, d)}</li>
              ))}
            </ul>
          )}
          <div className="confirm-actions">
            <button type="button" className="btn" onClick={props.onCancel}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" data-autofocus onClick={props.onConfirm}>
              {t(props.replacing ? 'preview.startNew' : 'preview.start')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
