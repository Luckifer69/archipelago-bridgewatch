import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { validateGraph } from '../src/engine/validate.js';

const node = (id, overrides = {}) => ({ id, name: `Island ${id}`, x: 50, y: 50, ...overrides });
const edge = (id, a, b) => ({ id, a, b });
const nodesNamed = (count) => Array.from({ length: count }, (_, i) => node(`N${String(i).padStart(2, '0')}`));
const codes = (errors) => errors.map((error) => error.code);

const onlyError = (input) => {
  const errors = validateGraph(input);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  return errors[0];
};

test('the main archipelago is valid and fits the demonstration limits', () => {
  assert.deepEqual(validateGraph(ARCHIPELAGO), []);
  assert.ok(ARCHIPELAGO.nodes.length >= 6 && ARCHIPELAGO.nodes.length <= 9);
  assert.ok(ARCHIPELAGO.edges.length >= 6 && ARCHIPELAGO.edges.length <= 13);
});

test('accepts the size boundaries: 1 node with 0 edges, and 12 nodes with 20 edges', () => {
  assert.deepEqual(validateGraph({ nodes: [node('A')], edges: [] }), []);

  const nodes = nodesNamed(12);
  const edges = [];
  for (let i = 0; i < 12 && edges.length < 20; i++) {
    for (let j = i + 1; j < 12 && edges.length < 20; j++) {
      edges.push(edge(`E${edges.length}`, nodes[i].id, nodes[j].id));
    }
  }
  assert.equal(edges.length, 20);
  assert.deepEqual(validateGraph({ nodes, edges }), []);
});

test('rejects 0 and 13 nodes, and 21 edges', () => {
  assert.equal(onlyError({ nodes: [], edges: [] }).code, 'node-count');
  assert.equal(onlyError({ nodes: nodesNamed(13), edges: [] }).code, 'node-count');

  const nodes = nodesNamed(12);
  const edges = [];
  for (let i = 0; i < 12 && edges.length < 21; i++) {
    for (let j = i + 1; j < 12 && edges.length < 21; j++) {
      edges.push(edge(`E${edges.length}`, nodes[i].id, nodes[j].id));
    }
  }
  assert.equal(onlyError({ nodes, edges }).code, 'edge-count');
});

test('rejects input without node and edge arrays', () => {
  for (const input of [null, undefined, 7, 'graph', [], {}, { nodes: [] }, { edges: [] }, { nodes: {}, edges: [] }]) {
    assert.equal(onlyError(input).code, 'bad-shape');
  }
});

test('reports non-object items instead of crashing', () => {
  assert.equal(onlyError({ nodes: [node('A'), null], edges: [] }).code, 'bad-node');
  assert.equal(onlyError({ nodes: [node('A')], edges: ['B01'] }).code, 'bad-edge');
});

test('coordinates: 0 and 100 are valid, and anything else outside that range is not', () => {
  assert.deepEqual(validateGraph({ nodes: [node('A', { x: 0, y: 100 })], edges: [] }), []);

  for (const axis of ['x', 'y']) {
    for (const value of [-0.01, 100.01]) {
      const error = onlyError({ nodes: [node('A', { [axis]: value })], edges: [] });
      assert.equal(error.code, 'coordinate-out-of-range');
      assert.equal(error.nodeId, 'A');
      assert.match(error.message, new RegExp(`Node "A" ${axis} must be from 0 through 100`));
    }
    for (const value of [NaN, Infinity, -Infinity, '50', null, undefined]) {
      const error = onlyError({ nodes: [node('A', { [axis]: value })], edges: [] });
      assert.equal(error.code, 'bad-coordinate');
      assert.equal(error.nodeId, 'A');
    }
  }
});

test('node IDs: format boundaries and duplicates', () => {
  for (const id of ['A', 'A1', 'A-1', 'A_1', 'ABCDEFGHIJKLMNOP']) {
    assert.deepEqual(validateGraph({ nodes: [node(id)], edges: [] }), [], id);
  }
  for (const id of ['', 'a', '1A', '-A', 'A B', 'Aa', 'ABCDEFGHIJKLMNOPQ', 'A\n', 7, null]) {
    assert.equal(onlyError({ nodes: [node(id)], edges: [] }).code, 'bad-node-id', String(id));
  }

  const error = onlyError({ nodes: [node('A'), node('A')], edges: [] });
  assert.equal(error.code, 'duplicate-node-id');
  assert.equal(error.nodeId, 'A');
});

test('node display name must be non-empty', () => {
  for (const name of ['', '   ', null, undefined, 7]) {
    const error = onlyError({ nodes: [node('A', { name })], edges: [] });
    assert.equal(error.code, 'bad-node-name');
    assert.equal(error.nodeId, 'A');
  }
});

test('edge IDs: invalid format and duplicates', () => {
  const nodes = [node('A'), node('B'), node('C')];
  for (const id of ['', 'e1', '1E', 'ABCDEFGHIJKLMNOPQ', 7]) {
    assert.equal(onlyError({ nodes, edges: [edge(id, 'A', 'B')] }).code, 'bad-edge-id', String(id));
  }

  const error = onlyError({ nodes, edges: [edge('E1', 'A', 'B'), edge('E1', 'B', 'C')] });
  assert.equal(error.code, 'duplicate-edge-id');
  assert.equal(error.edgeId, 'E1');
});

test('an edge and a node may share an ID, because they are separate kinds of item', () => {
  assert.deepEqual(validateGraph({ nodes: [node('A'), node('B')], edges: [edge('A', 'A', 'B')] }), []);
});

test('an unknown endpoint names the edge and the missing node', () => {
  const error = onlyError({ nodes: [node('A')], edges: [edge('E1', 'A', 'GHOST')] });
  assert.equal(error.code, 'unknown-endpoint');
  assert.equal(error.edgeId, 'E1');
  assert.equal(error.endpoint, 'GHOST');
  assert.match(error.message, /Edge "E1" connects to unknown node "GHOST"/);
});

test('self-loops are invalid', () => {
  const error = onlyError({ nodes: [node('A')], edges: [edge('E1', 'A', 'A')] });
  assert.equal(error.code, 'self-loop');
  assert.equal(error.edgeId, 'E1');
  assert.equal(error.endpoint, 'A');
});

test('the same pair is a duplicate connection in either direction', () => {
  const nodes = [node('A'), node('B')];
  for (const second of [edge('E2', 'A', 'B'), edge('E2', 'B', 'A')]) {
    const error = onlyError({ nodes, edges: [edge('E1', 'A', 'B'), second] });
    assert.equal(error.code, 'duplicate-connection');
    assert.equal(error.edgeId, 'E2');
    assert.match(error.message, /same two nodes as edge "E1"/);
  }
});

test('a bad node ID does not also report every edge that uses it', () => {
  const errors = validateGraph({ nodes: [node('bad'), node('B')], edges: [edge('E1', 'bad', 'B')] });
  assert.deepEqual(codes(errors), ['bad-node-id']);
});

test('all problems are reported together', () => {
  const errors = validateGraph({
    nodes: [node('A', { x: 101 }), node('A'), node('C', { name: '' })],
    edges: [edge('E1', 'A', 'A'), edge('E2', 'A', 'GHOST')],
  });
  assert.deepEqual(codes(errors), [
    'coordinate-out-of-range',
    'duplicate-node-id',
    'bad-node-name',
    'self-loop',
    'unknown-endpoint',
  ]);
});
