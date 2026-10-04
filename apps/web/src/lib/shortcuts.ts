/**
 * Page-wide history shortcuts. Letter shortcuts are matched by the PHYSICAL key (`KeyboardEvent.code`),
 * so Ctrl+Z is the same key on an English, Russian or any other layout — `key` there is "я" or "z"
 * depending on the layout. `key` is used only when the browser reports no `code` (some virtual
 * keyboards), and only for Latin letters.
 *
 * - undo: Ctrl / Cmd + Z
 * - redo: Ctrl / Cmd + Shift + Z, Ctrl / Cmd + Y
 */
export type HistoryShortcut = 'undo' | 'redo';

type KeyInput = Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>;

export function historyShortcut(e: KeyInput): HistoryShortcut | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const letter = physicalLetter(e);
  if (letter === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (letter === 'y') return 'redo';
  return null;
}

function physicalLetter(e: KeyInput): string | null {
  const match = /^Key([A-Z])$/.exec(e.code ?? '');
  if (match) return match[1]!.toLowerCase();
  if (e.code) return null;
  return /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : null;
}
