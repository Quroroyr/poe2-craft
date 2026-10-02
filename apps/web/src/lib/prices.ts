import type { ConsumableId } from '@poe2-craft/craft-domain';
import { MOCK_PRICE_SNAPSHOT, type PriceSnapshot } from '@poe2-craft/economy';

/** Raw text of price inputs, so half-typed values ("0.") don't fight the user. */
export type PriceInputs = Readonly<Record<ConsumableId, string>>;

export const INITIAL_PRICE_INPUTS: PriceInputs = Object.fromEntries(
  Object.entries(MOCK_PRICE_SNAPSHOT.prices).map(([id, price]) => [id, String(price)]),
);

/** Parses one input; null = empty or invalid, which economy reports as a missing price. */
export function parsePriceInput(text: string | undefined): number | null {
  if (text === undefined) return null;
  const normalised = text.trim().replace(',', '.');
  if (normalised === '') return null;
  const value = Number(normalised);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function snapshotFromInputs(inputs: PriceInputs, edited: boolean, reference: PriceSnapshot = MOCK_PRICE_SNAPSHOT): PriceSnapshot {
  const prices: Record<ConsumableId, number> = { ...reference.prices };
  for (const [id, text] of Object.entries(inputs)) {
    const value = parsePriceInput(text);
    if (value !== null) prices[id] = value;
    else delete prices[id];
  }
  return {
    ...reference,
    id: edited ? `${reference.id}:manual` : reference.id,
    source: edited ? 'manual' : reference.source,
    prices,
  };
}
