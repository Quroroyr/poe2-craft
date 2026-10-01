import { SAMPLE_ITEMS } from '@poe2-craft/item-parser';
import { Panel } from './Panel';

interface ItemInputProps {
  readonly text: string;
  readonly onChange: (text: string) => void;
}

export function ItemInput({ text, onChange }: ItemInputProps) {
  return (
    <Panel title="Текущий предмет" step="1">
      <label className="field-label" htmlFor="item-text">
        Наведите на предмет в игре, нажмите Ctrl+C (или Ctrl+Alt+C) и вставьте сюда
      </label>
      <textarea
        id="item-text"
        name="item-text"
        className="item-textarea"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        rows={14}
      />
      <div className="samples">
        <span className="samples-label">Примеры (fixture):</span>
        {SAMPLE_ITEMS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className={`chip${sample.text === text ? ' chip-active' : ''}`}
            onClick={() => onChange(sample.text)}
          >
            {sample.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}
