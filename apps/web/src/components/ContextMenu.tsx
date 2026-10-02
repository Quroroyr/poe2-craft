import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { MenuIntent, MenuItem, MenuModel } from '@/lib/mod-menu';
import { Icon } from './Icon';

interface ContextMenuProps {
  readonly model: MenuModel;
  /** Viewport point the menu opens at (pointer position or the corner of the "…" button). */
  readonly x: number;
  readonly y: number;
  readonly onIntent: (intent: MenuIntent) => void;
  readonly onClose: () => void;
}

const MARGIN = 8;

/**
 * The modifier context menu. Rendered into <body> so no card transform or overflow clips it, and
 * so its clicks never bubble into the craft zone. Opens at the pointer and stays inside the
 * viewport; Escape, a click outside, scrolling the page or resizing it close it. Arrow keys move,
 * Enter / Space choose, → opens a submenu and ← returns. Submenus open in place of the list, so
 * they fit on a phone as well.
 */
export function ContextMenu(props: ContextMenuProps) {
  const { model, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<MenuItem | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const items = submenu?.submenu?.items ?? model.items;

  // Measure, then clamp into the viewport: right/bottom edges flip the menu to the other side.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPlace(placeMenu(props.x, props.y, width, height, window.innerWidth, window.innerHeight));
  }, [props.x, props.y, submenu, model]);

  // The first usable item takes focus whenever the list changes — once the menu is placed
  // (an unplaced menu is hidden, and hidden elements cannot take focus).
  const placed = place !== null;
  useEffect(() => {
    if (placed) focusItem(ref.current, 0);
  }, [submenu, placed]);

  useEffect(() => {
    const inside = (target: EventTarget | null) => target instanceof Node && !!ref.current?.contains(target);
    const onPointerDown = (e: PointerEvent) => {
      if (!inside(e.target)) onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // The page also uses Escape (leave the pool editing mode): closing the menu comes first.
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const choose = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.submenu) {
      setSubmenu(item);
      return;
    }
    if (!item.intent) return;
    props.onIntent(item.intent);
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = menuItems(ref.current);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => list[(to + list.length) % list.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(at + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(at - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(list.length - 1);
        break;
      case 'ArrowRight': {
        const item = items[Number(list[at]?.dataset.index)];
        if (item?.submenu && !item.disabled) {
          e.preventDefault();
          setSubmenu(item);
        }
        break;
      }
      case 'ArrowLeft':
      case 'Backspace':
        if (submenu) {
          e.preventDefault();
          setSubmenu(null);
        }
        break;
      case 'Tab':
        onClose();
        break;
    }
  };

  return createPortal(
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      aria-label={submenu ? `${model.title}: ${submenu.submenu?.title}` : model.title}
      style={place ? { left: place.left, top: place.top } : { left: props.x, top: props.y, visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ctx-head">
        {submenu ? (
          <button type="button" className="ctx-back" role="menuitem" onClick={() => setSubmenu(null)}>
            <Icon name="left" size={13} />
            {submenu.submenu?.title}
          </button>
        ) : (
          <>
            <span className="ctx-title">{model.title}</span>
            {model.subtitle && <span className="ctx-subtitle">{model.subtitle}</span>}
          </>
        )}
      </div>
      <ul className="ctx-list">
        {items.map((item, i) => (
          <li key={item.id} className={item.separatorBefore ? 'ctx-sep' : undefined}>
            <button
              type="button"
              className={`ctx-item${item.checked ? ' is-checked' : ''}`}
              role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
              aria-checked={item.checked}
              aria-disabled={item.disabled || undefined}
              aria-haspopup={item.submenu ? 'menu' : undefined}
              data-index={i}
              data-id={item.id}
              title={item.reason}
              onClick={() => choose(item)}
            >
              <span className="ctx-icon" aria-hidden>
                {item.checked ? <Icon name="check" size={14} /> : item.icon ? <Icon name={item.icon} size={14} /> : null}
              </span>
              <span className="ctx-label">
                {item.label}
                {item.reason && <span className="ctx-reason">{item.reason}</span>}
              </span>
              {item.hint && <span className="ctx-hint">{item.hint}</span>}
              {item.submenu && <Icon name="chevron" size={13} className="ctx-chevron" />}
            </button>
          </li>
        ))}
      </ul>
      {model.note && !submenu && <p className="ctx-note">{model.note}</p>}
    </div>,
    document.body,
  );
}

/**
 * Where a menu of `width` × `height` opened at (x, y) goes: below-right of the point, flipped to
 * the left / above when it would leave the viewport, and never closer than MARGIN to an edge.
 */
export function placeMenu(x: number, y: number, width: number, height: number, vw: number, vh: number) {
  let left = x;
  let top = y;
  if (left + width > vw - MARGIN) left = Math.min(x - width, vw - width - MARGIN);
  if (top + height > vh - MARGIN) top = Math.min(y - height, vh - height - MARGIN);
  return { left: Math.max(MARGIN, left), top: Math.max(MARGIN, top) };
}

function menuItems(root: HTMLElement | null): HTMLElement[] {
  return root ? [...root.querySelectorAll<HTMLElement>('[role^="menuitem"]')] : [];
}

/** Focuses the checked item of a submenu, else the first usable one after `at`. */
function focusItem(root: HTMLElement | null, at: number) {
  const list = menuItems(root).filter((el) => el.dataset.index !== undefined);
  const checked = list.find((el) => el.getAttribute('aria-checked') === 'true');
  (checked ?? list.find((el, i) => i >= at && el.getAttribute('aria-disabled') !== 'true') ?? list[0])?.focus();
}
