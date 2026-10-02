import { expect, it } from 'vitest';
import { snapshotFromInputs } from './prices';
it('manual overrides survive refreshed market values, invalid or blank overrides stay unpriced', () => {
  const reference = { id:'live',unit:'div',source:'poe.ninja' as const,league:'Test',capturedAt:'2026-10-02',prices:{exalted:1,annul:2,divine:1} };
  const result = snapshotFromInputs({exalted:'0,5',annul:''},true,reference);
  expect(result.prices).toEqual({exalted:0.5,divine:1}); expect(result.league).toBe('Test'); expect(result.source).toBe('manual');
  expect(snapshotFromInputs({},false,{...reference,source:'manual',prices:{}}).prices).toEqual({});
  expect(snapshotFromInputs({exalted:'0,5'},true,{...reference,prices:{exalted:7}}).prices.exalted).toBe(0.5);
});
