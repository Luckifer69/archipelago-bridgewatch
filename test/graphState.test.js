import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { GraphState, loadGraph } from '../src/engine/graphState.js';

const node = (id) => ({ id, name: `Island ${id}`, x: 50, y: 50 });

const adjacencyOf = (graph) =>
  Object.fromEntries(graph.nodeIds.map((id) => [id, graph.neighbours(id).map((entry) => `${entry.neighbour} ${entry.edge}`)]));

// Typed from docs/ORACLE.md.
const MAIN_ADJACENCY = {
  ANCHOR: ['BARREL B01', 'COMPASS B03'],
  BARREL: ['ANCHOR B01', 'COMPASS B02'],
  COMPASS: ['ANCHOR B03', 'BARREL B02', 'DOUBLOON B04'],
  DOUBLOON: ['COMPASS B04', 'EMERALD B05', 'FLAG B07'],
  EMERALD: ['DOUBLOON B05', 'FLAG B06'],
  FLAG: ['DOUBLOON B07', 'EMERALD B06', 'GULL B08'],
  GULL: ['FLAG B08', 'HOOK B09'],
  HOOK: ['GULL B09'],
};

test('adjacency lists are sorted by neighbour ID and carry bridge IDs', () => {
  const { ok, graph } = loadGraph(ARCHIPELAGO);
  assert.ok(ok);
  assert.deepEqual(adjacencyOf(graph), MAIN_ADJACENCY);
});

test('source array order does not change the graph', () => {
  const expected = new GraphState(ARCHIPELAGO);
  const reversed = new GraphState({ nodes: [...ARCHIPELAGO.nodes].reverse(), edges: [...ARCHIPELAGO.edges].reverse() });
  assert.deepEqual(reversed.nodes, expected.nodes);
  assert.deepEqual(reversed.edges, expected.edges);
  assert.deepEqual(adjacencyOf(reversed), MAIN_ADJACENCY);
});

test('IDs sort in ASCII order, not locale order', () => {
  // ASCII puts '-' (45) before digits (48-57), then letters (65-90), then '_' (95).
  const ids = ['A_1', 'AB', 'A1', 'A-1'];
  const graph = new GraphState({ nodes: ids.map(node), edges: [] });
  assert.deepEqual(graph.nodeIds, ['A-1', 'A1', 'AB', 'A_1']);
  assert.notDeepEqual(graph.nodeIds, [...ids].sort((a, b) => a.localeCompare(b)));
});

test('edge IDs also sort in ASCII order, and neighbours sort by neighbour ID rather than edge ID', () => {
  const graph = new GraphState({
    nodes: ['A', 'B', 'C'].map(node),
    edges: [
      { id: 'E_2', a: 'A', b: 'C' },
      { id: 'E-1', a: 'A', b: 'B' },
      { id: 'E0', a: 'B', b: 'C' },
    ],
  });
  assert.deepEqual(graph.edgeIds, ['E-1', 'E0', 'E_2']);

  const reversedIds = new GraphState({
    nodes: ['A', 'B', 'C'].map(node),
    edges: [
      { id: 'Z1', a: 'A', b: 'B' },
      { id: 'A1', a: 'A', b: 'C' },
    ],
  });
  assert.deepEqual(reversedIds.neighbours('A'), [
    { neighbour: 'B', edge: 'Z1' },
    { neighbour: 'C', edge: 'A1' },
  ]);
});

test('an isolated island has an empty neighbour list', () => {
  assert.deepEqual(new GraphState({ nodes: [node('A')], edges: [] }).neighbours('A'), []);
});

test('lookups return the island and bridge details', () => {
  const graph = new GraphState(ARCHIPELAGO);
  assert.equal(graph.node('COMPASS').name, 'Compass Cove');
  assert.deepEqual(graph.edge('B04'), { id: 'B04', a: 'COMPASS', b: 'DOUBLOON' });
  assert.equal(graph.node('GHOST'), undefined);
});

test('GraphState is read-only, and later changes to the input do not reach it', () => {
  const input = { nodes: [node('A'), node('B')], edges: [{ id: 'E1', a: 'A', b: 'B' }] };
  const graph = new GraphState(input);

  input.nodes[0].x = 1;
  input.nodes.pop();
  input.edges[0].b = 'A';
  assert.equal(graph.node('A').x, 50);
  assert.deepEqual(graph.nodeIds, ['A', 'B']);
  assert.equal(graph.edge('E1').b, 'B');

  assert.throws(() => { graph.nodes.push(node('C')); }, TypeError);
  assert.throws(() => { graph.node('A').x = 1; }, TypeError);
  assert.throws(() => { graph.neighbours('A').pop(); }, TypeError);
  assert.throws(() => { graph.extra = true; }, TypeError);
});

test('invalid input returns errors and builds no GraphState', () => {
  const result = loadGraph({ nodes: [node('A')], edges: [{ id: 'E1', a: 'A', b: 'GHOST' }] });
  assert.equal(result.ok, false);
  assert.equal(result.graph, undefined);
  assert.equal(result.errors[0].code, 'unknown-endpoint');
});
