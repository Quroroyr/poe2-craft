import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemBase, ItemBaseId, ItemClassId } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import { classFacets, searchBases, type BaseSort } from '@/lib/base-catalog';
import { baseArt } from '@/lib/icons';
import { useI18n } from '@/i18n/I18nProvider';
import { sourceTitle } from '@/lib/texts';
import { requirementsText } from './ItemBits';
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
  const { t } = useI18n();
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
            <h2 id="base-dialog-title">{t('bases.title')}</h2>
            <p className="base-sheet-sub">
              {fixture ? t('bases.fixtureLead', { count: total }) : ''}
              {t(fixture ? 'bases.lead' : 'bases.realLead')}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </header>

        <div className="base-controls">
          <label className="search-field">
            <Icon name="search" />
            <input
              type="search"
              name="base-search"
              aria-label={t('bases.search')}
              placeholder={t('bases.searchPlaceholder')}
              value={text}
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="chip-row" role="group" aria-label={t('bases.classes')}>
            <button type="button" className="chip" aria-pressed={classId === null} onClick={() => setClassId(null)}>
              {t('bases.all')} <span className="chip-count">{total}</span>
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
              {t('bases.sort')}
              <select name="base-sort" value={sort} onChange={(e) => setSort(e.target.value as BaseSort)}>
                <option value="name">{t('bases.byName')}</option>
                <option value="level">{t('bases.byLevel')}</option>
              </select>
            </label>
            <div className="segmented" role="group" aria-label={t('bases.view')}>
              <button type="button" aria-pressed={layout === 'grid'} aria-label={t('bases.grid')} onClick={() => setLayout('grid')}>
                <Icon name="grid" />
              </button>
              <button type="button" aria-pressed={layout === 'list'} aria-label={t('bases.list')} onClick={() => setLayout('list')}>
                <Icon name="list" />
              </button>
            </div>
          </div>
        </div>

        {props.dropsModifiers && (
          <p className="sheet-note">{t('bases.dropsMods')}</p>
        )}

        {entries.length === 0 ? (
          <p className="empty base-empty">{t('bases.empty')}</p>
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

function BaseCard(props: {
  base: ItemBase;
  className: string;
  view: CraftDbView;
  current: boolean;
  layout: 'grid' | 'list';
  onSelect: () => void;
}) {
  const { base } = props;
  const { t } = useI18n();
  const details = base.details;
  const requirements = details ? requirementsText(t, details.requirements, ' · ') : null;
  return (
    <button
      type="button"
      className={`base-card${props.current ? ' base-card-current' : ''}`}
      onClick={props.onSelect}
      aria-label={t('bases.select', { name: base.name })}
    >
      <span className="base-card-art">
        <ItemArt art={baseArt(base)} label={base.name} maxHeight={props.layout === 'grid' ? 150 : 72} />
      </span>
      <span className="base-card-body">
        <span className="base-card-name">{base.name}</span>
        <span className="base-card-class">
          {props.className}
          {props.current && <span className="tag tag-ok">{t('bases.current')}</span>}
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
            <span className="base-reqs num">{requirements ?? t('bases.noRequirements')}</span>
          </>
        ) : (
          <span className="muted small">{t('bases.propsUnknown')}</span>
        )}
        <span className="base-source" title={details?.provenance.notes}>
          {details ? sourceTitle(t, props.view, details.provenance) : t('bases.noSource')}
        </span>
      </span>
      <span className="base-card-pick">{t('bases.pick')}</span>
    </button>
  );
}
