import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { Icon } from './Icon';

interface ManualEditDialogProps {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Asked once per page session, before the first hand edit of the current item: such an edit is a
 * sandbox step, not crafting, and is not counted as spending.
 */
export function ManualEditDialog(props: ManualEditDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) {
      dialog.showModal?.();
      // showModal focuses the first control; the main action should have it.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!props.open && dialog.open) dialog.close?.();
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby="manual-edit-title"
      aria-describedby="manual-edit-text"
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
    >
      {props.open && (
        <div className="confirm-sheet">
          <h2 id="manual-edit-title">
            <Icon name="pencil" size={16} />
            {t('manual.title')}
          </h2>
          <p id="manual-edit-text">{t('manual.notice')}</p>
          <p className="muted small">{t('manual.detail')}</p>
          <div className="confirm-actions">
            <button type="button" className="btn" onClick={props.onCancel}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" data-autofocus onClick={props.onConfirm}>
              {t('manual.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
