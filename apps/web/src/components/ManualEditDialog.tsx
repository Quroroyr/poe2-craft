import { useEffect, useRef } from 'react';
import { MANUAL_EDIT_NOTICE } from '@/lib/texts';
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

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal?.();
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
            Ручная правка текущего предмета
          </h2>
          <p id="manual-edit-text">{MANUAL_EDIT_NOTICE}</p>
          <p className="muted small">
            Правка попадёт в историю как отдельный шаг: её можно отменить (Ctrl+Z) и вернуть (Ctrl+Shift+Z). Больше это
            окно в этой вкладке не появится.
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn" onClick={props.onCancel}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary" autoFocus onClick={props.onConfirm}>
              Понятно, изменить
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
