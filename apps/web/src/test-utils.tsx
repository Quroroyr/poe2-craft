/**
 * DOM test helpers: render the real workspace (happy-dom) in a chosen language, optionally from the
 * demo session. The demo samples are test/demo material only — the site itself starts empty.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createSession, type CraftSession } from '@poe2-craft/craft-session';
import { SAMPLE_ITEMS, SAMPLE_TARGET_ITEMS } from '@poe2-craft/item-parser';
import { Workspace } from '@/components/Workspace';
import type { Locale } from '@/i18n/core';
import { I18nProvider } from '@/i18n/I18nProvider';
import { DEFAULT_GAME_VERSION, importSource, importTarget } from '@/lib/analyze';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The v0.6 demo: sample spear (fractured local critical chance T1) and the sample target. */
export function demoSession(): CraftSession {
  return createSession({
    gameVersion: DEFAULT_GAME_VERSION,
    seed: 4242,
    source: importSource(SAMPLE_ITEMS[0]?.text ?? '', DEFAULT_GAME_VERSION),
    target: importTarget(SAMPLE_TARGET_ITEMS[0]?.text ?? '', DEFAULT_GAME_VERSION),
  });
}

export interface Mounted {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly unmount: () => Promise<void>;
}

/** `locale` undefined: the provider decides (English, or what localStorage holds). */
export async function renderWorkspace(options: { locale?: Locale; session?: CraftSession } = {}): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <I18nProvider initialLocale={options.locale}>
        <Workspace initialSession={options.session} />
      </I18nProvider>,
    ),
  );
  return {
    container,
    root,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

export const run = (fn: () => void) => act(async () => fn());
export const click = (el: Element) => run(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
export const keyOn = (target: EventTarget, key: string, init: KeyboardEventInit = {}) =>
  run(() => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })));

/** A Ctrl+V on the page: a paste event carrying `text`, dispatched on `target` (default: body). */
export const paste = (text: string, target: EventTarget = document.body) =>
  run(() => {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    target.dispatchEvent(event);
  });

/** Sets a controlled field the way a user does, so React's onChange runs. */
export const setField = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) =>
  run(() => {
    const proto =
      el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });

export const button = (scope: ParentNode, text: string) => {
  const found = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(text));
  if (!found) throw new Error(`no button "${text}"`);
  return found;
};

export const $ = <T extends Element = HTMLElement>(selector: string, scope: ParentNode = document) => {
  const el = scope.querySelector(selector);
  if (!el) throw new Error(`not found: ${selector}`);
  return el as unknown as T;
};
