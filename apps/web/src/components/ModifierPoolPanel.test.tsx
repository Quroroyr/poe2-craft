// @vitest-environment happy-dom
/**
 * Picking modifiers for the source and the target in the real workspace: a whole tier row is the
 * control, the pool stays open with its tab, family and filters, and the selected row stays in
 * place, highlighted from the actual source / target state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { $ as query, button, click, demoSession, keyOn, renderWorkspace, setField, type Mounted } from '@/test-utils';

// Russian interface on the v0.6 demo session: these checks also cover the RU texts of the picker.
let mounted: Mounted;
beforeEach(async () => {
  mounted = await renderWorkspace({ locale: 'ru', session: demoSession() });
});
afterEach(async () => {
  await mounted.unmount();
});

const $ = <T extends Element = HTMLElement>(selector: string) => query<T>(selector, mounted.container);
const press = (el: Element, key: string) => keyOn(el, key);

/** The picker in front: the one of the setup surface when it is open, else the page's. */
const pool = () => mounted.container.querySelector<HTMLElement>('.setup-surface .panel-pool') ?? $('.panel-pool');
const row = (modifierId: string) => pool().querySelector<HTMLElement>(`.pick-row[data-modifier-id="${modifierId}"]`);
const family = (label: string) => button(pool().querySelector('.family-list')!, label);
const tab = (label: string) => [...pool().querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.startsWith(label))!;
const sourceSuffixes = () => $('[aria-label="Суффиксы исходного"]').textContent ?? '';
const count = (text: string, part: string) => text.split(part).length - 1;

/** Starting modifiers are edited on the setup surface ("Изменить исходный"), with the same picker. */
const openSourceSetup = () => click(button($('.start-strip'), 'Изменить исходный'));
const openSourceSuffixes = async () => {
  await openSourceSetup();
  await click(button($('.setup-surface .panel-source'), 'Добавить суффикс'));
  await click(family('Attack Speed'));
};

/** An empty target on the current base ("Собрать цель" opens its picker), then the suffix picker on Attack Speed. */
const openTargetSuffixes = async () => {
  await click(button($('.panel-target'), 'Сброс'));
  await click(button($('.panel-target'), 'Собрать цель'));
  await click(button($('.panel-target .target-add'), 'Суффикс'));
  await click(family('Attack Speed'));
};

describe('editing pool: whole-row picking', () => {
  it('the whole tier row is the control — no action column, no buttons inside rows', async () => {
    await openSourceSuffixes();
    expect(pool().querySelector('table')).toBeNull();
    expect(pool().querySelector('th')).toBeNull();
    const t1 = row('mod.local-attack-speed.t1')!;
    expect(t1.getAttribute('role')).toBe('button');
    expect(t1.tabIndex).toBe(0);
    expect(t1.querySelector('button')).toBeNull();
  });

  it('clicking T1 adds it to the source; the row stays visible and highlighted', async () => {
    await openSourceSuffixes();
    expect(count(sourceSuffixes(), 'Attack Speed')).toBe(0);

    await click(row('mod.local-attack-speed.t1')!.querySelector('.pick-meta')!);

    expect(count(sourceSuffixes(), 'Attack Speed')).toBe(1);
    const t1 = row('mod.local-attack-speed.t1');
    expect(t1).not.toBeNull();
    expect(t1!.getAttribute('aria-pressed')).toBe('true');
    expect(t1!.className).toContain('pick-selected');
    expect(t1!.textContent).toContain('выбран');
  });

  it('search, tag, status filter, family and tab survive a pick; the picker is not remounted', async () => {
    await openSourceSuffixes();
    const search = pool().querySelector<HTMLInputElement>('input[name="pool-search"]')!;
    const tag = pool().querySelector<HTMLSelectElement>('select[name="pool-tag"]')!;
    const status = pool().querySelector<HTMLSelectElement>('select[name="pool-status"]')!;
    await setField(search, 'attack');
    await setField(tag, 'speed');
    const scroller = pool().querySelector('.pick-scroll')!;

    await click(row('mod.local-attack-speed.t1')!);

    expect(pool().querySelector<HTMLInputElement>('input[name="pool-search"]')!.value).toBe('attack');
    expect(pool().querySelector<HTMLSelectElement>('select[name="pool-tag"]')!.value).toBe('speed');
    expect(pool().querySelector<HTMLSelectElement>('select[name="pool-status"]')!.value).toBe(status.value);
    expect(family('Attack Speed').getAttribute('aria-pressed')).toBe('true');
    expect(tab('Суффиксы').getAttribute('aria-selected')).toBe('true');
    expect(pool().querySelector('.mode-line-edit')).not.toBeNull();
    // Same DOM node: no remount, so the scroll position cannot jump.
    expect(pool().querySelector('.pick-scroll')).toBe(scroller);
  });

  it('the prefix tab survives a pick too, and the next modifier can be picked right away', async () => {
    await openSourceSetup();
    await click(button($('.setup-surface .panel-source'), 'Добавить суффикс'));
    await click(tab('Префиксы'));
    await click(family('Increased Physical'));
    await click(row('mod.local-physical-percent.t1')!);
    expect(tab('Префиксы').getAttribute('aria-selected')).toBe('true');
    expect(row('mod.local-physical-percent.t1')!.getAttribute('aria-pressed')).toBe('true');

    await click(family('Adds Fire'));
    await click(row('mod.local-flat-fire.t1')!);
    const prefixes = $('[aria-label="Префиксы исходного"]').textContent ?? '';
    expect(prefixes).toContain('Physical Damage');
    expect(prefixes).toContain('Fire Damage');
  });

  it('another tier of the same family replaces the source modifier instead of adding a duplicate', async () => {
    await openSourceSuffixes();
    await click(row('mod.local-attack-speed.t2')!);
    await click(row('mod.local-attack-speed.t1')!);

    expect(count(sourceSuffixes(), 'Attack Speed')).toBe(1);
    expect(sourceSuffixes()).toContain('Mastery');
    expect(row('mod.local-attack-speed.t1')!.getAttribute('aria-pressed')).toBe('true');
    expect(row('mod.local-attack-speed.t2')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking T1 adds a target requirement; another tier moves it instead of duplicating', async () => {
    await openTargetSuffixes();
    await click(row('mod.local-attack-speed.t2')!);
    const rows = () => [...$('.panel-target').querySelectorAll('.target-rows > li')];
    expect(rows()).toHaveLength(1);
    expect(row('mod.local-attack-speed.t2')!.getAttribute('aria-pressed')).toBe('true');
    expect(row('mod.local-attack-speed.t2')!.textContent).toContain('в цели');

    await click(row('mod.local-attack-speed.t1')!);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.querySelector('select')!.value).toBe('mod.local-attack-speed.t1');
    expect(row('mod.local-attack-speed.t1')!.getAttribute('aria-pressed')).toBe('true');
    expect(row('mod.local-attack-speed.t2')!.getAttribute('aria-pressed')).toBe('false');
    expect(family('Attack Speed').getAttribute('aria-pressed')).toBe('true');
  });

  it('an unavailable row cannot be picked by click or keyboard', async () => {
    // The sample source has local critical chance; the critical hybrid shares its group.
    await openSourceSetup();
    await click(button($('.setup-surface .panel-source'), 'Добавить суффикс'));
    await setField(pool().querySelector<HTMLSelectElement>('select[name="pool-status"]')!, 'all');
    const before = sourceSuffixes();
    const hybrid = row('mod.local-critical-hybrid.t1')!;
    expect(hybrid.getAttribute('aria-disabled')).toBe('true');
    expect(hybrid.tabIndex).toBe(-1);
    expect(hybrid.className).toContain('pick-unavailable');

    await click(hybrid);
    await press(hybrid, 'Enter');
    expect(sourceSuffixes()).toBe(before);
  });

  it('Enter and Space on a focused row pick it', async () => {
    await openSourceSuffixes();
    await press(row('mod.local-attack-speed.t2')!, 'Enter');
    expect(row('mod.local-attack-speed.t2')!.getAttribute('aria-pressed')).toBe('true');
    await press(row('mod.local-attack-speed.t1')!, ' ');
    expect(row('mod.local-attack-speed.t1')!.getAttribute('aria-pressed')).toBe('true');
    expect(count(sourceSuffixes(), 'Attack Speed')).toBe(1);
  });

  it('saving the setup surface hands the picked starting modifiers to the session', async () => {
    await openSourceSuffixes();
    await click(row('mod.local-attack-speed.t1')!);
    await click(button($('.setup-surface'), 'Сохранить исходный'));
    expect(mounted.container.querySelector('.setup-surface')).toBeNull();
    // No crafting yet: the current item follows the starting item.
    expect($('.panel-current').textContent).toContain('Attack Speed');
  });

  it('inspect mode keeps the detailed technical table', async () => {
    expect(pool().querySelector('table.pool-table')).not.toBeNull();
    expect(pool().querySelector('.pick-row')).toBeNull();
    const heads = [...pool().querySelectorAll('th')].map((th) => th.textContent);
    expect(heads).toEqual(expect.arrayContaining(['Ур. мода', 'Доля', 'Группа', 'Теги', 'Статус']));
  });
});
