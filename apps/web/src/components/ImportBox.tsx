import { useState } from 'react';
import type { SampleItem } from '@poe2-craft/item-parser';

interface ImportBoxProps {
  readonly id: string;
  readonly label: string;
  readonly samples: readonly SampleItem[];
  /** Called with the pasted / typed / sample text; the parent decides what importing means. */
  readonly onImport: (text: string) => void;
  readonly defaultOpen?: boolean;
  /** false: always open, without the disclosure summary (the parent already toggles it). */
  readonly collapsible?: boolean;
}

/**
 * Collapsible "paste from the game" box. Importing replaces the item; manual edits made after
 * the import are lost on the next import, so importing is an explicit action.
 */
export function ImportBox({ id, label, samples, onImport, defaultOpen = false, collapsible = true }: ImportBoxProps) {
  const [text, setText] = useState('');
  const body = (
    <>
      <textarea
        id={id}
        name={id}
        className="item-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData('text');
          if (pasted.trim()) {
            e.preventDefault();
            setText(pasted);
            onImport(pasted);
          }
        }}
        spellCheck={false}
        rows={4}
        placeholder="Ctrl+C в игре → Ctrl+V сюда (импорт сразу)"
      />
      <div className="samples">
        <button type="button" className="btn btn-small" disabled={!text.trim()} onClick={() => onImport(text)}>
          Импортировать
        </button>
        {samples.map((sample) => (
          <button key={sample.id} type="button" className="chip" onClick={() => onImport(sample.text)}>
            {sample.label}
          </button>
        ))}
      </div>
    </>
  );
  if (!collapsible) {
    return (
      <div className="import-box import-box-static">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {body}
      </div>
    );
  }
  return (
    <details className="import-box" open={defaultOpen}>
      <summary>{label}</summary>
      {body}
    </details>
  );
}
