import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIXED } from '../fixtures/graphs.js';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { Replay } from '../src/replay.js';
import { ISLAND_RADIUS, mapModel, placeLabels } from '../src/ui/mapModel.js';

const fresh = (source = ARCHIPELAGO) => {
  const replay = new Replay(source);
  replay.load();
  return replay;
};

const viewAt = (position, source) => {
  const replay = fresh(source);
  for (let i = 0; i <= position; i++) replay.step();
  return replay.view();
};

const edgeOf = (model, id) => model.edges.find((edge) => edge.id === id);
const nodeOf = (model, id) => model.nodes.find((node) => node.id === id);

test('there is no map before a graph is loaded', () => {
  assert.equal(mapModel(new Replay(ARCHIPELAGO).view()), null);
});

test('before the first event everything is unvisited, with nothing marked as current', () => {
  const model = mapModel(fresh().view());
  for (const edge of model.edges) {
    assert.equal(edge.status, 'unvisited');
    assert.equal(edge.isCurrent, false);
    assert.equal(edge.label, edge.id);
  }
  for (const node of model.nodes) {
    assert.equal(node.status, 'unvisited');
    assert.equal(node.isCurrent, false);
    assert.equal(node.values, '');
    assert.equal(node.shape, 'circle');
  }
});

test('the current event highlights its island and bridge, using a marker as well as colour', () => {
  // Event 17: FLAG looks back at DOUBLOON over B07.
  const model = mapModel(viewAt(16));
  assert.equal(nodeOf(model, 'FLAG').isCurrent, true);
  assert.equal(nodeOf(model, 'FLAG').title, '▶ FLAG');
  assert.equal(edgeOf(model, 'B07').isCurrent, true);
  assert.equal(edgeOf(model, 'B07').label, '▶ ↺ B07');
  assert.equal(model.nodes.filter((node) => node.isCurrent).length, 1);
  assert.equal(model.edges.filter((edge) => edge.isCurrent).length, 1);
});

test('the map shows the numbers each island has reached so far', () => {
  const model = mapModel(viewAt(16));
  assert.equal(nodeOf(model, 'FLAG').values, 'd5 · l3');
  assert.equal(nodeOf(model, 'GULL').values, '');
});

test('the final map distinguishes every state without relying on colour', () => {
  const replay = fresh();
  replay.runToEnd();
  const model = mapModel(replay.view());

  assert.equal(edgeOf(model, 'B04').status, 'bridge');
  assert.equal(edgeOf(model, 'B04').label, '⚠ B04');
  assert.equal(edgeOf(model, 'B03').status, 'non-tree');
  assert.equal(edgeOf(model, 'B03').label, '↺ B03');
  assert.equal(edgeOf(model, 'B01').status, 'tree');
  assert.equal(edgeOf(model, 'B01').label, 'B01');

  for (const id of ['COMPASS', 'DOUBLOON', 'FLAG', 'GULL']) {
    assert.equal(nodeOf(model, id).shape, 'diamond', id);
    assert.ok(nodeOf(model, id).title.includes('◆'), id);
  }
  for (const id of ['BARREL', 'EMERALD', 'HOOK']) {
    assert.equal(nodeOf(model, id).shape, 'circle', id);
    assert.ok(!nodeOf(model, id).title.includes('◆'), id);
  }
  // ANCHOR is the root, so the last event leaves it current, but never a diamond.
  assert.equal(nodeOf(model, 'ANCHOR').shape, 'circle');
});

test('each island and bridge has a text description of its state', () => {
  const replay = fresh();
  replay.runToEnd();
  const model = mapModel(replay.view());
  assert.match(edgeOf(model, 'B04').description, /B04 between COMPASS and DOUBLOON: critical bridge/);
  assert.match(nodeOf(model, 'DOUBLOON').description, /Doubloon Dunes \(DOUBLOON\), hosts Music stage: visited, articulation island/);
});

test('positions come from the graph data', () => {
  const model = mapModel(fresh().view());
  const source = ARCHIPELAGO.nodes.find((node) => node.id === 'HOOK');
  assert.equal(nodeOf(model, 'HOOK').x, source.x);
  assert.equal(nodeOf(model, 'HOOK').y, source.y);
});

test('the view box contains every island and label', () => {
  const { viewBox, nodes } = mapModel(fresh().view());
  for (const node of nodes) {
    assert.ok(node.label.left >= viewBox.x && node.label.right <= viewBox.x + viewBox.width, node.id);
    assert.ok(node.label.top >= viewBox.y && node.label.bottom <= viewBox.y + viewBox.height, node.id);
  }
});

test('labels stay in the same place at every event, so nothing jumps during a replay', () => {
  const replay = fresh();
  const expected = mapModel(replay.view()).nodes.map((node) => node.label);
  while (replay.step()) {
    assert.deepEqual(mapModel(replay.view()).nodes.map((node) => node.label), expected);
  }
});

test('source array order does not change label placement', () => {
  const reversed = { nodes: [...ARCHIPELAGO.nodes].reverse(), edges: [...ARCHIPELAGO.edges].reverse() };
  const labels = (source) => [...placeLabels(fresh(source).view().graph).entries()];
  assert.deepEqual(labels(reversed), labels(ARCHIPELAGO));
});

test('island labels clear each other, all islands and all bridges on the main map', () => {
  const { graph } = fresh().view();
  const labels = [...placeLabels(graph).entries()];
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  for (const [i, [id, box]] of labels.entries()) {
    for (const [otherId, otherBox] of labels.slice(i + 1)) {
      assert.ok(!overlap(box, otherBox), `${id} label overlaps ${otherId} label`);
    }
    for (const node of graph.nodes) {
      const r = ISLAND_RADIUS * 1.3;
      const island = { left: node.x - r, right: node.x + r, top: node.y - r, bottom: node.y + r };
      assert.ok(!overlap(box, island), `${id} label overlaps island ${node.id}`);
    }
    for (const edge of graph.edges) {
      const [a, b] = [graph.node(edge.a), graph.node(edge.b)];
      for (let t = 0; t <= 1; t += 0.01) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        assert.ok(!(x > box.left && x < box.right && y > box.top && y < box.bottom), `${id} label touches ${edge.id}`);
      }
    }
  }
});

test('a graph with an isolated island still produces a model', () => {
  const model = mapModel(viewAt(0, MIXED));
  assert.equal(model.nodes.length, 7);
  assert.equal(nodeOf(model, 'A').isCurrent, true);
  assert.equal(nodeOf(model, 'A').values, 'd0 · l0');
});
