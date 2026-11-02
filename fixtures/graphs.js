// Test graphs and expected values, typed by hand from docs/ORACLE.md. Application code never imports this file.

const graph = (ids, edges) => ({
  nodes: ids.map((id) => ({ id, name: `Island ${id}`, x: 50, y: 50 })),
  edges: edges.map(([id, a, b]) => ({ id, a, b })),
});

const table = (rows) => rows.map(([id, parent, discovery, low]) => ({ id, parent, discovery, low }));

export const CYCLE = graph(['A', 'B', 'C', 'D'], [
  ['E1', 'A', 'B'],
  ['E2', 'B', 'C'],
  ['E3', 'C', 'D'],
  ['E4', 'A', 'D'],
]);

export const MIXED = graph(['A', 'B', 'C', 'D', 'E', 'F', 'G'], [
  ['E1', 'A', 'B'],
  ['E2', 'A', 'C'],
  ['E3', 'E', 'F'],
  ['E4', 'F', 'G'],
  ['E5', 'E', 'G'],
]);

export const BOWTIE = graph(['A', 'B', 'C', 'D', 'E'], [
  ['E1', 'A', 'B'],
  ['E2', 'B', 'C'],
  ['E3', 'A', 'C'],
  ['E4', 'C', 'D'],
  ['E5', 'D', 'E'],
  ['E6', 'C', 'E'],
]);

export const EXPECTED_MAIN = {
  discoveryOrder: ['ANCHOR', 'BARREL', 'COMPASS', 'DOUBLOON', 'EMERALD', 'FLAG', 'GULL', 'HOOK'],
  table: table([
    ['ANCHOR', null, 0, 0],
    ['BARREL', 'ANCHOR', 1, 0],
    ['COMPASS', 'BARREL', 2, 0],
    ['DOUBLOON', 'COMPASS', 3, 3],
    ['EMERALD', 'DOUBLOON', 4, 3],
    ['FLAG', 'EMERALD', 5, 3],
    ['GULL', 'FLAG', 6, 6],
    ['HOOK', 'GULL', 7, 7],
  ]),
  componentCount: 1,
  bridges: ['B04', 'B08', 'B09'],
  articulations: ['COMPASS', 'DOUBLOON', 'FLAG', 'GULL'],
};

export const EXPECTED_CYCLE = {
  discoveryOrder: ['A', 'B', 'C', 'D'],
  table: table([
    ['A', null, 0, 0],
    ['B', 'A', 1, 0],
    ['C', 'B', 2, 0],
    ['D', 'C', 3, 0],
  ]),
  componentCount: 1,
  bridges: [],
  articulations: [],
};

export const EXPECTED_MIXED = {
  discoveryOrder: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  table: table([
    ['A', null, 0, 0],
    ['B', 'A', 1, 1],
    ['C', 'A', 2, 2],
    ['D', null, 3, 3],
    ['E', null, 4, 4],
    ['F', 'E', 5, 4],
    ['G', 'F', 6, 4],
  ]),
  componentCount: 3,
  bridges: ['E1', 'E2'],
  articulations: ['A'],
};

export const EXPECTED_BOWTIE = {
  discoveryOrder: ['A', 'B', 'C', 'D', 'E'],
  table: table([
    ['A', null, 0, 0],
    ['B', 'A', 1, 0],
    ['C', 'B', 2, 0],
    ['D', 'C', 3, 2],
    ['E', 'D', 4, 2],
  ]),
  componentCount: 1,
  bridges: [],
  articulations: ['C'],
};

export function seededShuffle(items, seed) {
  const result = [...items];
  let state = seed;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 16807) % 2147483647;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
