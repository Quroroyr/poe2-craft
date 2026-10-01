import type { CraftDbView } from '@poe2-craft/craft-db';
import type { ItemParseResult, SampleItem } from '@poe2-craft/item-parser';
import { diagnosticText } from '@/lib/texts';
import type { ModBadge } from '@/lib/session-ui';
import { ItemCard } from './ItemCard';
import { Panel } from './Panel';

interface ItemPastePanelProps {
  readonly id: string;
  readonly title: string;
  readonly step: string;
  readonly hint: string;
  readonly text: string;
  readonly onText: (text: string) => void;
  readonly samples: readonly SampleItem[];
  readonly parse: ItemParseResult | null;
  readonly view: CraftDbView;
  readonly badges?: ReadonlyMap<number, ModBadge>;
  readonly aside?: React.ReactNode;
}

/** Side panel of the workspace: paste an item from the game and see how it was read. */
export function ItemPastePanel(props: ItemPastePanelProps) {
  const { parse } = props;
  const warnings = parse?.diagnostics.filter((d) => d.code !== 'unresolved-modifier') ?? [];
  return (
    <Panel title={props.title} step={props.step} aside={props.aside}>
      <label className="field-label" htmlFor={props.id}>
        {props.hint}
      </label>
      <textarea
        id={props.id}
        name={props.id}
        className="item-textarea"
        value={props.text}
        onChange={(e) => props.onText(e.target.value)}
        spellCheck={false}
        rows={5}
        placeholder="Ctrl+C в игре → Ctrl+V сюда"
      />
      <div className="samples">
        {props.samples.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className={`chip${sample.text === props.text ? ' chip-active' : ''}`}
            onClick={() => props.onText(sample.text)}
          >
            {sample.label}
          </button>
        ))}
        {props.text && (
          <button type="button" className="chip chip-quiet" onClick={() => props.onText('')}>
            очистить
          </button>
        )}
      </div>

      {parse && (
        <div className="paste-result">
          <ItemCard
            item={parse.state}
            view={props.view}
            name={parse.parsed.nameLines.length > 1 ? parse.parsed.nameLines[0] : null}
            badges={props.badges}
          />
          {warnings.length > 0 && (
            <ul className="notes">
              {warnings.map((d, i) => (
                <li key={i}>{diagnosticText(d)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
