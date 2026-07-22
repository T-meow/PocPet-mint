import type { NeighborIdentity, NeighborReference } from './petTypes';
import { hashString } from './utils';

export const neighborGiftDailyLimit = 3;

const sortedNeighbors = (neighbors: readonly NeighborIdentity[]) =>
  [...neighbors].sort((left, right) => left.modId.localeCompare(right.modId));

export const selectNeighborReference = (
  seed: string,
  neighbors: readonly NeighborIdentity[],
): NeighborReference => {
  const available = sortedNeighbors(neighbors);
  if (available.length === 0) return { kind: 'generic' };
  return { kind: 'mod', modId: available[hashString(`${seed}:neighbor`) % available.length].modId };
};

export const resolveNeighborName = (
  reference: NeighborReference | undefined,
  neighbors: readonly NeighborIdentity[],
) => {
  if (reference?.kind !== 'mod') return undefined;
  return neighbors.find((neighbor) => neighbor.modId === reference.modId)?.name;
};
