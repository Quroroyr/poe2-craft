// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { $, button, click, paste, renderWorkspace, setField, type Mounted } from '@/test-utils';
let mounted: Mounted | undefined;
let price = 1;
const item = 'Item Class: Rings\nRarity: Rare\nTest Item\nTopaz Ring\n--------\nItem Level: 82\n--------\n+25% to Lightning Resistance (implicit)\n--------\n+21 to maximum Life (fractured)\n+15% to Fire Resistance';
beforeEach(() => {
  localStorage.clear(); price = 1;
  vi.stubGlobal('fetch',vi.fn(async (url:string) => new Response(JSON.stringify(url === '/api/prices' ? [{id:'Test',name:'Test'}] : {id:'live',source:'poe.ninja',league:'Test',capturedAt:'2026-10-02T00:00:00Z',unit:'div',prices:{exalted:price,annul:2}}))));
});
afterEach(async () => { await mounted?.unmount(); mounted = undefined; vi.unstubAllGlobals(); });
it('uses real data, preserves clipboard implicit/fracture and refuses Exalt without history or spending', async () => {
  mounted = await renderWorkspace({dataset:'real'}); const root = mounted.container;
  expect($<HTMLSelectElement>('[name="dataset"]',root).value).toBe('real'); expect(root.textContent).toContain('REAL DATA');
  await paste(item); expect($('.preview-dialog',root).textContent).toContain('Topaz Ring');
  await click(button($('.preview-dialog',root),'Start crafting'));
  expect($('.panel-current',root).textContent).toContain('+21 to maximum Life');
  expect($('.panel-current',root).textContent).toContain('+25% to Lightning Resistance');
  expect($('.panel-current',root).textContent).not.toContain('demo pool');
  const before = root.querySelectorAll('.current-mod').length;
  await click($('.craft-zone',root));
  expect($('.panel-current',root).textContent).toContain('unknown');
  expect(root.querySelectorAll('.current-mod')).toHaveLength(before);
  expect(root.querySelectorAll('.history-row')).toHaveLength(0);
  expect($('.panel-spending',root).textContent).not.toContain('(mock)');
  await click(button($('.start-strip',root),'Edit starting item'));
  await click(button($('.panel-source',root),'Add prefix'));
  expect(root.querySelectorAll('.pick-row').length).toBeGreaterThan(0);
});
it('keeps a manually entered price through a market refresh and separates manual base cost', async () => {
  mounted = await renderWorkspace({dataset:'real'}); const root = mounted.container;
  await paste(item); await click(button($('.preview-dialog',root),'Start crafting'));
  await setField($<HTMLInputElement>('[name="base-price"]',root),'8');
  await click(button($('.panel-spending',root),'Consumable prices'));
  expect($('.price-controls',root).textContent).toContain('poe.ninja');
  const input = $<HTMLInputElement>('[name="price-exalted"]',root);
  await setField(input,'0,5'); price = 7;
  await click(button($('.price-controls',root),'Refresh prices'));
  expect(input.value).toBe('0,5');
  await click(button($('.panel-spending',root),'Costs'));
  expect($<HTMLInputElement>('[name="base-price"]',root).value).toBe('8');
  expect($('.active-craft',root).textContent).toContain('0.5 div');
  expect($('.stage-facts',root).textContent).not.toContain('%');
});
