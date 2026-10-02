import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemBase, ItemBaseId, ItemClassId } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { classFacets, searchBases, type BaseSort } from '@/lib/base-catalog';
import { baseArt } from '@/lib/icons';
import { sourceTitle } from '@/lib/texts';
import { Icon } from './Icon';
import { ItemArt } from './ItemArt';

interface BaseSelectorProps {
  readonly open: boolean;
  readonly view: CraftDbView;
  /** Base of the current source, highlighted in the list. */
  readonly currentBaseId: ItemBaseId | null;
  /** The source already has modifiers that a new base would drop. */
  readonly dropsModifiers: boolean;
  readonly onSelect: (baseId: ItemBaseId) => void;
  readonly onClose: () => void;
}

/**
 * Picks the base a manually built source starts from. Reads the catalog through CraftDbView, so a
 * full BaseDB import changes what is listed here without touching this component.
 */
export function BaseSelector(props: BaseSelectorProps) {
  const { open, view } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  const [classId, setClassId] = useState<ItemClassId | null>(null);
  const [sort, setSort] = useState<BaseSort>('name');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const facets = useMemo(() => classFacets(view), [view]);
  const entries = useMemo(() => searchBases(view, { text, classId, sort }), [view, text, classId, sort]);
  const total = view.listBases().length;
  const fixture = view.info.kind === 'fixture';

  return (
    <dialog
      ref={dialogRef}
      className="base-dialog"
      aria-labelledby="base-dialog-title"
      onClose={props.onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself, outside the sheet) closes it.
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="base-sheet">
        <header className="base-sheet-head">
          <div>
            <h2 id="base-dialog-title">Выбор базы</h2>
            <p className="base-sheet-sub">
              {fixture ? `Демо-каталог: ${total} баз трёх классов. ` : ''}
              Названия, свойства и картинки — из официального трейда PoE 2; теги и веса модов — демо-данные.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Закрыть" onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </header>

        <div className="base-controls">
          <label className="search-field">
            <Icon name="search" />
            <input
              type="search"
              name="base-search"
              aria-label="Поиск базы"
              placeholder="Название базы или класса"
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="chip-row" role="group" aria-label="Класс предмета">
            <button type="button" className="chip" aria-pressed={classId === null} onClick={() => setClassId(null)}>
              Все <span className="chip-count">{total}</span>
            </button>
            {facets.map((f) => (
              <button
                key={f.itemClass.id}
                type="button"
                className="chip"
                aria-pressed={classId === f.itemClass.id}
                onClick={() => setClassId(f.itemClass.id)}
              >
                {f.itemClass.clipboardName} <span className="chip-count">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="base-controls-end">
            <label className="inline-field">
              Сортировка
              <select name="base-sort" value={sort} onChange={(e) => setSort(e.target.value as BaseSort)}>
                <option value="name">по названию</option>
                <option value="level">по уровню</option>
              </select>
            </label>
            <div className="segmented" role="group" aria-label="Вид списка">
              <button type="button" aria-pressed={layout === 'grid'} aria-label="Сетка" onClick={() => setLayout('grid')}>
                <Icon name="grid" />
              </button>
              <button type="button" aria-pressed={layout === 'list'} aria-label="Список" onClick={() => setLayout('list')}>
                <Icon name="list" />
              </button>
            </div>
          </div>
        </div>

        {props.dropsModifiers && (
          <p className="sheet-note">Новая база начинает исходный заново: его моды будут сброшены. Цель не меняется.</p>
        )}

        {entries.length === 0 ? (
          <p className="empty base-empty">Ничего не найдено. Сбросьте фильтр класса или измените запрос.</p>
        ) : (
          <ul className={`base-list base-list-${layout}`}>
            {entries.map(({ base, itemClass }) => (
              <li key={base.id}>
                <BaseCard
                  base={base}
                  className={itemClass?.clipboardName ?? base.itemClassId}
                  view={view}
                  current={base.id === props.currentBaseId}
                  layout={layout}
                  onSelect={() => props.onSelect(base.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

const REQUIREMENT_LABEL = { level: 'Уровень', strength: 'Str', dexterity: 'Dex', intelligence: 'Int' } as const;

function BaseCard(props: {
  base: ItemBase;
  className: string;
  view: CraftDbView;
  current: boolean;
  layout: 'grid' | 'list';
  onSelect: () => void;
}) {
  const { base } = props;
  const details = base.details;
  const requirements = details
    ? (Object.keys(REQUIREMENT_LABEL) as (keyof typeof REQUIREMENT_LABEL)[]).flatMap((key) => {
        const value = details.requirements[key];
        return value === undefined ? [] : [`${REQUIREMENT_LABEL[key]} ${value}`];
      })
    : [];
  return (
    <button
      type="button"
      className={`base-card${props.current ? ' base-card-current' : ''}`}
      onClick={props.onSelect}
      aria-label={`Выбрать ${base.name}`}
    >
      <span className="base-card-art">
        <ItemArt art={baseArt(base)} label={base.name} maxHeight={props.layout === 'grid' ? 150 : 72} />
      </span>
      <span className="base-card-body">
        <span className="base-card-name">{base.name}</span>
        <span className="base-card-class">
          {props.className}
          {props.current && <span className="tag tag-ok">текущая</span>}
        </span>
        {details ? (
          <>
            <span className="base-props">
              {details.properties.map((p) => (
                <span key={p.name} className="base-prop">
                  <span className="muted">{p.name}</span> <span className="num">{p.value}</span>
                </span>
              ))}
            </span>
            {details.implicits.map((line) => (
              <span key={line} className="base-implicit">
                {line}
              </span>
            ))}
            <span className="base-reqs num">{requirements.length > 0 ? requirements.join(' · ') : 'без требований'}</span>
          </>
        ) : (
          <span className="muted small">Свойства базы неизвестны</span>
        )}
        <span className="base-source" title={details?.provenance.notes}>
          {details ? sourceTitle(props.view, details.provenance) : 'источник свойств не указан'}
        </span>
      </span>
      <span className="base-card-pick">Выбрать</span>
    </button>
  );
}
