import type { MouseEvent } from 'react';
import { Icon } from './Icon';

/**
 * The keyboard and touch way to the same menu as the right click. Its clicks and keys stop here,
 * so pressing it never crafts.
 */
export function ModMoreButton(props: { label: string; open: boolean; onMenu: (x: number, y: number) => void }) {
  const open = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const box = e.currentTarget.getBoundingClientRect();
    props.onMenu(box.left, box.bottom + 2);
  };
  return (
    <button
      type="button"
      className="mod-more"
      aria-label={props.label}
      aria-haspopup="menu"
      aria-expanded={props.open}
      onClick={open}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Icon name="more" size={15} />
    </button>
  );
}
