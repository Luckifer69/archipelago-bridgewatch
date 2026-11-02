import { POSITIONS } from './positions.js';
import { BRIDGES, ISLANDS } from './topology.js';

export const ARCHIPELAGO = {
  nodes: ISLANDS.map((island) => ({ ...island, ...POSITIONS[island.id] })),
  edges: BRIDGES.map((bridge) => ({ ...bridge })),
};
