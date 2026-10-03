import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BaseRequirements, ItemBase, ItemBaseId } from '@poe2-craft/craft-domain';
import type { CraftDbView } from '@poe2-craft/craft-db';
import {
  NAV_ROOT,
  basesAt,
  buildBaseNavigation,
  byLevel,
  locateBase,
  parentPath,
  searchOffered,
  type BaseNavigation,
  type NavCategory,
  type NavClass,
  type NavGroupId,
  type NavPath,
  type NavSectionId,
} from '@/lib/base-navigation';
import { baseArt } from '@/lib/icons';
import { useI18n } from '@/i18n/I18nProvider';
import type { Translator } from '@/i18n/core';
import { requirementsText } from './ItemBits';
import { Icon } from './Icon';
import { ItemArt } from './ItemArt';

interface BaseSelectorProps {
  readonly open: boolean;
  readonly view: CraftDbView;
  /** Base of the current source: the selector opens at its group and marks it. */
  readonly currentBaseId: ItemBaseId | null;
  /** The source already has modifiers that a new base would drop. */
  readonly dropsModifiers: boolean;
  readonly onSelect: (baseId: ItemBaseId) => void;
  readonly onClose: () => void;
}

type Sort = 'level' | 'name';
const SECTIONS: readonly NavSectionId[] = ['armour', 'jewellery', 'weapons', 'offhand'];

/**
 * Picks the base a manually built item starts from, in two or three steps:
 * item type → kind (defence type or weapon class, when there is a choice) → base.
 * Only player-facing bases of craftable classes are offered (lib/base-navigation.ts);
 * "Search all bases" is a shortcut over the same list.
 */
export function BaseSelector(props: BaseSelectorProps) {
  const { open, view } = props;
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrolls = useRef(new Map<string, number>());
  const nav = useMemo(() => buildBaseNavigation(view), [view]);
  const [path, setPath] = useState<NavPath>(NAV_ROOT);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<Sort>('level');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Reopening for an existing item starts at its group; a fresh item keeps the last place.
      const at = props.currentBaseId ? locateBase(nav, props.currentBaseId) : null;
      if (at) setPath({ category: at.category, classId: at.itemClass.id, group: at.group });
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
    // Opening is the only trigger; the current base is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Another dataset has another catalog: start from the first step.
  useEffect(() => setPath(NAV_ROOT), [nav]);

  const key = JSON.stringify(path);
  // Each level keeps its own scroll position, so Back returns to where the user was.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = scrolls.current.get(key) ?? 0;
  }, [key]);
  const go = (next: NavPath) => {
    if (bodyRef.current) scrolls.current.set(key, bodyRef.current.scrollTop);
    setFilter('');
    setPath(next);
  };
  const back = () => go(parentPath(nav, path));

  const category = nav.categories.find((c) => c.id === path.category) ?? null;
  const cls = category?.classes.find((c) => c.itemClass.id === path.classId) ?? null;
  const listed = basesAt(nav, path);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchOffered(nav, query) : []), [nav, query, searching]);
  const shown = useMemo(() => {
    if (!listed) return [];
    const found = searchOffered(nav, filter, listed);
    return sort === 'name' ? [...found].sort((a, b) => a.name.localeCompare(b.name)) : [...found].sort(byLevel);
  }, [nav, listed, filter, sort]);
  const atRoot = path.category === null;

  const crumbs: { label: string; to: NavPath | null }[] = [{ label: t('nav.root'), to: atRoot ? null : NAV_ROOT }];
  if (category && category.section === 'weapons') crumbs.push({ label: t(`nav.cat.${category.id}`), to: cls ? { ...NAV_ROOT, category: category.id } : null });
  if (cls) crumbs.push({ label: cls.itemClass.clipboardName, to: path.group !== null ? { ...path, group: null } : null });
  if (path.group !== null) crumbs.push({ label: groupLabel(t, path.group), to: null });
  const here = crumbs[crumbs.length - 1]!.label;

  return (
    <dialog
      ref={dialogRef}
      className="base-dialog"
      aria-labelledby="base-dialog-title"
      onClose={props.onClose}
      onCancel={(e) => {
        // Escape clears the search, then steps back, and only closes the selector at the first step.
        if (searching) {
          e.preventDefault();
          setQuery('');
        } else if (!atRoot) {
          e.preventDefault();
          back();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div className="base-sheet">
        <header className="base-sheet-head">
          <div>
            <h2 id="base-dialog-title">{t('bases.title')}</h2>
            <p className="base-sheet-sub">{view.info.kind === 'fixture' ? t('bases.lead') : t('bases.realLead')}</p>
          </div>
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            <Icon name="close" />
          </button>
        </header>

        <div className="nav-bar">
          {!atRoot && !searching && (
            <button type="button" className="btn nav-back" onClick={back}>
              <Icon name="left" /> {t('nav.back')}
            </button>
          )}
          <nav className="nav-crumbs" aria-label={t('nav.crumbs')}>
            <ol>
              {crumbs.map((c, i) => (
                <li key={i}>
                  {c.to && !searching ? (
                    <button type="button" className="crumb" onClick={() => go(c.to!)}>
                      {c.label}
                    </button>
                  ) : (
                    <span className="crumb crumb-here" aria-current={i === crumbs.length - 1 ? 'step' : undefined}>
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <label className="search-field nav-search">
            <Icon name="search" />
            <input
              type="search"
              name="base-search"
              aria-label={t('nav.searchAll')}
              placeholder={t('nav.searchAll')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {props.dropsModifiers && <p className="sheet-note">{t('bases.dropsMods')}</p>}

        <div className="nav-body" ref={bodyRef}>
          {searching ? (
            <>
              <p className="nav-count">{t('nav.results', { count: results.length })}</p>
              {results.length === 0 ? (
                <p className="empty base-empty">{t('nav.noResults')}</p>
              ) : (
                <BaseRows bases={results} nav={nav} current={props.currentBaseId} onSelect={props.onSelect} withContext />
              )}
            </>
          ) : atRoot ? (
            <RootStep nav={nav} onOpen={go} />
          ) : !cls && category ? (
            <ClassStep category={category} onOpen={(c) => go({ ...path, classId: c.itemClass.id })} />
          ) : cls && !listed ? (
            <GroupStep cls={cls} onOpen={(g) => go({ ...path, group: g })} />
          ) : (
            <>
              <div className="nav-tools">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    name="group-search"
                    aria-label={t('nav.searchIn', { name: here })}
                    placeholder={t('nav.searchIn', { name: here })}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
                <label className="inline-field">
                  {t('bases.sort')}
                  <select name="base-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="level">{t('bases.byLevel')}</option>
                    <option value="name">{t('bases.byName')}</option>
                  </select>
                </label>
                <span className="nav-count">{t('nav.count', { count: shown.length })}</span>
              </div>
              {shown.length === 0 ? (
                <p className="empty base-empty">{t('nav.noResults')}</p>
              ) : (
                <BaseRows bases={shown} nav={nav} current={props.currentBaseId} onSelect={props.onSelect} />
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

type Attribute = 'str' | 'dex' | 'int';

function groupLabel(t: Translator, group: NavGroupId): string {
  return group === 'special' ? t('nav.group.special') : group.split('_').map((a) => t(`nav.attr.${a as Attribute}`)).join('/');
}

function groupHint(t: Translator, group: NavGroupId): string {
  return group === 'special' ? t('nav.group.specialHint') : group.split('_').map((a) => t(`nav.def.${a as Attribute}`)).join(' + ');
}

/** Requirements without the level: the row already shows it next to the name. */
function attributesOnly(requirements: BaseRequirements): BaseRequirements {
  const { level: _level, ...attributes } = requirements;
  return attributes;
}

/** Art of the highest-level base: a recognisable picture for a tile. */
const tileArt = (bases: readonly ItemBase[]) => [...bases].reverse().find((b) => b.artAssetId) ?? bases[0];

function levelSpan(t: Translator, bases: readonly ItemBase[]): string {
  const levels = bases.map((b) => b.dropLevel ?? b.details?.requirements.level ?? 0);
  const [from, to] = [Math.min(...levels), Math.max(...levels)];
  return from === to ? t('nav.level', { level: from }) : t('nav.levels', { from, to });
}

function Tile(props: { title: string; hint?: string; bases: readonly ItemBase[]; onOpen: () => void }) {
  const { t } = useI18n();
  const art = tileArt(props.bases);
  return (
    <button type="button" className="nav-tile" onClick={props.onOpen}>
      <span className="nav-tile-art" aria-hidden="true">
        {art && <ItemArt art={baseArt(art)} label="" maxHeight={64} />}
      </span>
      <span className="nav-tile-text">
        <span className="nav-tile-title">{props.title}</span>
        {props.hint && <span className="nav-tile-hint">{props.hint}</span>}
        <span className="nav-tile-meta">
          {t('nav.count', { count: props.bases.length })} · {levelSpan(t, props.bases)}
        </span>
      </span>
      <Icon name="chevron" />
    </button>
  );
}

function RootStep(props: { nav: BaseNavigation; onOpen: (path: NavPath) => void }) {
  const { t } = useI18n();
  return (
    <div className="nav-sections">
      {SECTIONS.map((section) => {
        const categories = props.nav.categories.filter((c) => c.section === section);
        if (categories.length === 0) return null;
        return (
          <section key={section} className="nav-section" aria-label={t(`nav.section.${section}`)}>
            <h3>{t(`nav.section.${section}`)}</h3>
            <div className="nav-tiles">
              {section === 'weapons'
                ? categories.map((c) => (
                    <Tile
                      key={c.id}
                      title={t(`nav.cat.${c.id}`)}
                      hint={c.classes.map((x) => x.itemClass.clipboardName).join(', ')}
                      bases={c.classes.flatMap((x) => x.bases)}
                      onOpen={() => props.onOpen({ ...NAV_ROOT, category: c.id })}
                    />
                  ))
                : categories.flatMap((c) =>
                    c.classes.map((x) => (
                      <Tile
                        key={x.itemClass.id}
                        title={x.itemClass.clipboardName}
                        bases={x.bases}
                        onOpen={() => props.onOpen({ category: c.id, classId: x.itemClass.id, group: null })}
                      />
                    )),
                  )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ClassStep(props: { category: NavCategory; onOpen: (cls: NavClass) => void }) {
  return (
    <div className="nav-tiles">
      {props.category.classes.map((c) => (
        <Tile key={c.itemClass.id} title={c.itemClass.clipboardName} bases={c.bases} onOpen={() => props.onOpen(c)} />
      ))}
    </div>
  );
}

function GroupStep(props: { cls: NavClass; onOpen: (group: NavGroupId) => void }) {
  const { t } = useI18n();
  return (
    <div className="nav-tiles">
      {(props.cls.groups ?? []).map((g) => (
        <Tile key={g.id} title={groupLabel(t, g.id)} hint={groupHint(t, g.id)} bases={g.bases} onOpen={() => props.onOpen(g.id)} />
      ))}
    </div>
  );
}

function BaseRows(props: {
  bases: readonly ItemBase[];
  nav: BaseNavigation;
  current: ItemBaseId | null;
  onSelect: (id: ItemBaseId) => void;
  withContext?: boolean;
}) {
  const { t } = useI18n();
  return (
    <ul className="nav-rows">
      {props.bases.map((base) => {
        const at = props.withContext ? locateBase(props.nav, base.id) : null;
        const details = base.details;
        const level = base.dropLevel ?? details?.requirements.level;
        return (
          <li key={base.id}>
            <button
              type="button"
              className={`nav-row${base.id === props.current ? ' nav-row-current' : ''}`}
              aria-label={t('bases.select', { name: base.name })}
              onClick={() => props.onSelect(base.id)}
            >
              <span className="nav-row-art">
                <ItemArt art={baseArt(base)} label={base.name} maxHeight={84} />
              </span>
              <span className="nav-row-body">
                <span className="nav-row-head">
                  <span className="nav-row-name">{base.name}</span>
                  {level !== undefined && <span className="nav-row-level num">{t('nav.level', { level })}</span>}
                  {base.id === props.current && <span className="tag tag-ok">{t('bases.current')}</span>}
                </span>
                {at && (
                  <span className="nav-row-context">
                    {at.itemClass.clipboardName}
                    {at.group ? ` · ${groupLabel(t, at.group)}` : ''}
                  </span>
                )}
                {details && details.properties.length > 0 && (
                  <span className="nav-row-props">
                    {details.properties.map((p) => (
                      <span key={p.name}>
                        <span className="muted">{p.name}</span> <span className="num">{p.value}</span>
                      </span>
                    ))}
                  </span>
                )}
                {details?.implicits.map((line) => (
                  <span key={line} className="base-implicit">
                    {line}
                  </span>
                ))}
                {details && <span className="base-reqs num">{requirementsText(t, attributesOnly(details.requirements), ' · ') ?? t('bases.noRequirements')}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
