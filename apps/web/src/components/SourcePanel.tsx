import { useState } from 'react';
import type { AffixSide, ItemState } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { SAMPLE_ITEMS } from '@poe2-craft/item-parser';
import { blankItem, familyTiers, removeSourceModifier, replaceSourceModifier } from '@poe2-craft/craft-session';
import type { ExplorerMode } from '@/lib/analyze';
import { ImportBox } from './ImportBox';
import { ItemCard } from './ItemCard';
import { Panel } from './Panel';

interface SourcePanelProps {
  readonly source: ItemState | null;
  readonly view: CraftDbView;
  readonly explorerMode: ExplorerMode;
  readonly onImport: (text: string) => void;
  /** Manual edit of the source. Never counted as spending. */
  readonly onEdit: (source: ItemState) => void;
  readonly onExplore: (mode: ExplorerMode) => void;
}

export function SourcePanel({ source, view, explorerMode, onImport, onEdit, onExplore }: SourcePanelProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const editing = explorerMode.kind === 'edit-source';

  return (
    <Panel title="Исходный" step="1" aside={<span className="badge">ручная правка</span>}>
      <ImportBox id="source-text" label="Импорт из игры" samples={SAMPLE_ITEMS} onImport={onImport} defaultOpen={!source} />

      {source ? (
        <ItemCard
          item={source}
          view={view}
          renderModActions={(index, mod) => {
            const def = mod.kind === 'resolved' ? view.getModifier(mod.modifierId) : undefined;
            const open = openIndex === index;
            return (
              <div className="mod-actions">
                <button
                  type="button"
                  className="link-btn"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  {open ? 'скрыть' : 'изменить'}
                </button>
                {open && (
                  <div className="mod-actions-row">
                    {def && (
                      <label className="inline-field">
                        тир
                        <select
                          name={`source-tier-${index}`}
                          value={def.id}
                          onChange={(e) => {
                            const next = view.getModifier(e.target.value);
                            if (next) onEdit(replaceSourceModifier(source, index, next));
                          }}
                        >
                          {familyTiers(view, def).map((t) => (
                            <option key={t.id} value={t.id} disabled={t.requiredItemLevel > (source.itemLevel ?? 0)}>
                              T{t.tier} · {t.name}
                              {t.requiredItemLevel > (source.itemLevel ?? 0) ? ` (ilvl ${t.requiredItemLevel})` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {def && (
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={() => onExplore({ kind: 'edit-source', side: def.side, replaceIndex: index })}
                      >
                        Заменить…
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => {
                        setOpenIndex(null);
                        onEdit(removeSourceModifier(source, index));
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            );
          }}
          renderSideFooter={(side: AffixSide, used, max) => {
            const active = editing && explorerMode.side === side && explorerMode.replaceIndex === undefined;
            return (
              <button
                type="button"
                className={`add-btn${active ? ' add-btn-active' : ''}`}
                disabled={max !== undefined && used >= max}
                onClick={() => onExplore({ kind: 'edit-source', side })}
              >
                + {side === 'prefix' ? 'Добавить префикс' : 'Добавить суффикс'}
              </button>
            );
          }}
        />
      ) : (
        <BlankItemForm view={view} onCreate={onEdit} />
      )}
      <p className="hint">Правки исходного — это описание базы, а не крафт: валюта на них не тратится.</p>
    </Panel>
  );
}

function BlankItemForm({ view, onCreate }: { view: CraftDbView; onCreate: (item: ItemState) => void }) {
  const bases = view.listBases();
  const [baseId, setBaseId] = useState(bases[0]?.id ?? '');
  const [itemLevel, setItemLevel] = useState(82);
  const base = view.getBase(baseId);
  return (
    <div className="blank-form">
      <p className="empty">Нет исходного предмета. Импортируйте его или создайте пустую базу.</p>
      <div className="controls">
        <label className="control">
          <span className="field-label">База</span>
          <select name="blank-base" value={baseId} onChange={(e) => setBaseId(e.target.value)}>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="control control-narrow">
          <span className="field-label">ilvl</span>
          <input
            name="blank-ilvl"
            className="num-input"
            type="number"
            min={1}
            max={100}
            value={itemLevel}
            onChange={(e) => setItemLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
          />
        </label>
      </div>
      <button type="button" className="btn" disabled={!base} onClick={() => base && onCreate(blankItem(base, itemLevel))}>
        Создать пустой редкий предмет
      </button>
    </div>
  );
}
