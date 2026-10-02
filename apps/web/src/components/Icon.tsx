/** Interface icons: one authored set, 1.6px stroke on a 20px grid, inheriting currentColor. */
const PATHS = {
  undo: 'M7.5 5.5 4 9l3.5 3.5M4.5 9h7a4.5 4.5 0 0 1 0 9H9',
  redo: 'M12.5 5.5 16 9l-3.5 3.5M15.5 9h-7a4.5 4.5 0 0 0 0 9H11',
  reset: 'M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5',
  close: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  chevron: 'M7.5 5l5 5-5 5',
  left: 'M12.5 5l-5 5 5 5',
  pencil: 'M12.5 4.5l3 3L7 16H4v-3zM11 6l3 3',
  book: 'M4 4.5h5a2 2 0 0 1 2 2V16a1.5 1.5 0 0 0-1.5-1.5H4zM16 4.5h-5a2 2 0 0 0-2 2V16a1.5 1.5 0 0 1 1.5-1.5H16z',
  alert: 'M10 3.5 17 16H3zM10 8.5v3.5M10 14v.01',
  plus: 'M10 4.5v11M4.5 10h11',
  minus: 'M4.5 10h11',
  search: 'M8.75 14.5a5.75 5.75 0 1 0 0-11.5 5.75 5.75 0 0 0 0 11.5ZM13 13l3.5 3.5',
  grid: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z',
  list: 'M4 5.5h12M4 10h12M4 14.5h12',
  ban: 'M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM5.4 14.6l9.2-9.2',
  swap: 'M5 7h10l-3-3M15 13H5l3 3',
  crack: 'M10 2.5 8.5 7l3 2.5-2 4 1.5 4M8.5 7 5 8.5M11.5 9.5l3.5-1',
  import: 'M10 3.5v9M6.5 9 10 12.5 13.5 9M4 15.5h12',
  hammer: 'M11 4.5l4.5 4.5-2 2L9 6.5zM10 8l-6 6 2 2 6-6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
