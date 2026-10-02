import { useEffect, useRef, useState } from 'react';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { useI18n } from '@/i18n/I18nProvider';
import { Icon } from './Icon';

interface ImportDialogProps {
  readonly demo?: boolean;
  /** null: closed. `source` leads to the preview of a new craft; `target` sets the target. */
  readonly purpose: 'source' | 'target' | null;
  /** The last submitted text was not an item. */
  readonly error: string | null;
  /** The same entry as a Ctrl+V on the page: one parser, one recognition, one flow. */
  readonly onSubmit: (text: string) => void;
  readonly onCancel: () => void;
}

/**
 * Paste box for an item copied in the game. Pasting submits at once; typing needs the button.
 * The demo examples are here for trying the planner — they are never loaded on their own.
 */
export function ImportDialog(props: ImportDialogProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const open = props.purpose !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      // showModal focuses the first control; the main action (or the text box) should have it.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close?.();
    if (!open) setText('');
  }, [open]);

  const samples = props.purpose === 'target' ? SAMPLE_TARGET_ITEMS : SAMPLE_ITEMS;
  return (
    <dialog
      ref={ref}
      className="confirm-dialog import-dialog"
      aria-labelledby="import-title"
      onCancel={(e) => {
        e.preventDefault();
        props.onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
    >
      {open && (
        <div className="confirm-sheet">
          <h2 id="import-title">
            <Icon name="import" size={16} />
            {t(props.purpose === 'target' ? 'import.title.target' : 'import.title.source')}
          </h2>
          <label className="field-label" htmlFor="import-text">
            {t('import.label')}
          </label>
          <textarea
            id="import-text"
            name="import-text"
            className="item-textarea"
            value={text}
            data-autofocus
            spellCheck={false}
            rows={8}
            placeholder={t('import.placeholder')}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted.trim()) {
                e.preventDefault();
                setText(pasted);
                props.onSubmit(pasted);
              }
            }}
          />
          {props.error && (
            <p className="state-box state-bad" role="alert">
              {props.error}
            </p>
          )}
          {props.demo !== false && <div className="samples">
            <span className="muted small">{t('import.samples')}</span>
            {samples.map((sample) => (
              <button key={sample.id} type="button" className="chip" onClick={() => props.onSubmit(sample.text)}>
                {sample.label}
              </button>
            ))}
          </div>}
          <div className="confirm-actions">
            <button type="button" className="btn" onClick={props.onCancel}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => props.onSubmit(text)}>
              {t(props.purpose === 'target' ? 'import.setTarget' : 'import.preview')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
