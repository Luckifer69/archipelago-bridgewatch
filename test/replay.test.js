import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CYCLE, EXPECTED_MAIN } from '../fixtures/graphs.js';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { Replay } from '../src/replay.js';

const loaded = () => {
  const replay = new Replay(ARCHIPELAGO);
  replay.load();
  return replay;
};

const stepAll = (replay) => {
  const stepped = [];
  for (let event = replay.step(); event; event = replay.step()) stepped.push(event);
  return stepped;
};

const INVALID = {
  'out-of-range coordinate': {
    input: { nodes: [{ id: 'A', name: 'A', x: 101, y: 0 }], edges: [] },
    code: 'coordinate-out-of-range',
  },
  'duplicate node ID': {
    input: { nodes: [{ id: 'A', name: 'A', x: 0, y: 0 }, { id: 'A', name: 'B', x: 0, y: 0 }], edges: [] },
    code: 'duplicate-node-id',
  },
  'unknown endpoint': {
    input: { nodes: [{ id: 'A', name: 'A', x: 0, y: 0 }], edges: [{ id: 'E1', a: 'A', b: 'GHOST' }] },
    code: 'unknown-endpoint',
  },
  'self-loop': {
    input: { nodes: [{ id: 'A', name: 'A', x: 0, y: 0 }], edges: [{ id: 'E1', a: 'A', b: 'A' }] },
    code: 'self-loop',
  },
  'duplicate connection': {
    input: {
      nodes: [{ id: 'A', name: 'A', x: 0, y: 0 }, { id: 'B', name: 'B', x: 0, y: 0 }],
      edges: [{ id: 'E1', a: 'A', b: 'B' }, { id: 'E2', a: 'B', b: 'A' }],
    },
    code: 'duplicate-connection',
  },
};

test('before anything is loaded there is nothing to show or step through', () => {
  const replay = new Replay(ARCHIPELAGO);
  const view = replay.view();
  assert.equal(view.graph, null);
  assert.equal(view.snapshot, null);
  assert.equal(view.total, 0);
  assert.equal(replay.step(), null);
});

test('loading shows the pre-traversal state at the start of the events', () => {
  const view = loaded().view();
  assert.equal(view.position, -1);
  assert.equal(view.total, 56);
  assert.equal(view.event, null);
  assert.deepEqual(view.history, []);
  assert.deepEqual(view.errors, []);
  assert.equal(view.snapshot.nodes.ANCHOR.discovery, null);
  assert.equal(view.snapshot.edges.B01, 'unvisited');
});

test('Step advances exactly one event at a time', () => {
  const replay = loaded();
  const first = replay.step();
  assert.equal(first.seq, 0);
  assert.equal(replay.view().position, 0);
  assert.equal(replay.view().event, first);
  assert.equal(replay.view().snapshot, first.snapshot);
  assert.deepEqual(replay.view().history, [first]);

  const second = replay.step();
  assert.equal(second.seq, 1);
  assert.equal(replay.view().position, 1);
  assert.equal(replay.view().history.length, 2);
});

test('Step at the end does nothing', () => {
  const replay = loaded();
  replay.runToEnd();
  const before = replay.view();
  assert.equal(replay.step(), null);
  assert.deepEqual(replay.view(), before);
});

test('Run to End reaches the documented result and keeps the full history', () => {
  const replay = loaded();
  replay.runToEnd();
  const view = replay.view();
  assert.ok(view.atEnd);
  assert.equal(view.position, 55);
  assert.equal(view.history.length, 56);
  assert.deepEqual(view.result, EXPECTED_MAIN);
  assert.deepEqual(view.snapshot.bridges, EXPECTED_MAIN.bridges);
  assert.deepEqual(view.snapshot.articulations, EXPECTED_MAIN.articulations);
});

test('stepped and complete runs end identically', () => {
  const stepped = loaded();
  const events = stepAll(stepped);
  assert.equal(events.length, 56);

  const complete = loaded();
  complete.runToEnd();
  assert.deepEqual(stepped.view(), complete.view());
});

test('repeated stepped and complete runs give identical histories and results', () => {
  const replay = loaded();
  replay.runToEnd();
  const expected = replay.view();

  for (let round = 0; round < 3; round++) {
    replay.reset();
    stepAll(replay);
    assert.deepEqual(replay.view(), expected);

    replay.reset();
    replay.runToEnd();
    assert.deepEqual(replay.view(), expected);
  }
});

test('Reset restores the pre-traversal state exactly, from any position', () => {
  const start = loaded().view();

  const midway = loaded();
  for (let i = 0; i < 23; i++) midway.step();
  midway.reset();
  assert.deepEqual(midway.view(), start);

  const finished = loaded();
  finished.runToEnd();
  finished.reset();
  assert.deepEqual(finished.view(), start);

  finished.reset();
  assert.deepEqual(finished.view(), start);
});

test('Reset restores the original graph after another graph was loaded', () => {
  const start = loaded().view();
  const replay = loaded();
  assert.ok(replay.load(CYCLE));
  assert.deepEqual(replay.view().graph.nodeIds, ['A', 'B', 'C', 'D']);
  replay.step();

  replay.reset();
  assert.deepEqual(replay.view(), start);
});

test('Reset before any load shows the original graph', () => {
  const replay = new Replay(ARCHIPELAGO);
  replay.reset();
  assert.deepEqual(replay.view(), loaded().view());
});

test('Load again restores the same pre-traversal state', () => {
  const replay = loaded();
  const start = replay.view();
  replay.runToEnd();
  replay.load();
  assert.deepEqual(replay.view(), start);
});

for (const [name, { input, code }] of Object.entries(INVALID)) {
  test(`${name}: a failed load names the problem and leaves no old output`, () => {
    const replay = loaded();
    for (let i = 0; i < 30; i++) replay.step();

    assert.equal(replay.load(input), false);
    const view = replay.view();
    assert.equal(view.errors[0].code, code);
    assert.equal(view.graph, null);
    assert.equal(view.result, null);
    assert.equal(view.event, null);
    assert.equal(view.snapshot, null);
    assert.deepEqual(view.history, []);
    assert.equal(view.total, 0);
    assert.equal(view.position, -1);
    assert.equal(replay.step(), null);
  });
}

test('Run to End after a failed load stays empty', () => {
  const replay = loaded();
  replay.load(INVALID['self-loop'].input);
  replay.runToEnd();
  assert.equal(replay.view().position, -1);
  assert.equal(replay.view().event, null);
});

test('Reset after a failed load restores the original graph and clears the errors', () => {
  const start = loaded().view();
  const replay = loaded();
  replay.load(INVALID['duplicate node ID'].input);
  replay.reset();
  assert.deepEqual(replay.view(), start);
});

test('a successful load clears earlier errors', () => {
  const replay = new Replay(ARCHIPELAGO);
  replay.load(INVALID['self-loop'].input);
  assert.equal(replay.view().errors.length, 1);
  replay.load();
  assert.deepEqual(replay.view().errors, []);
});

test('replaying never changes the graph or the source data', () => {
  const source = structuredClone(ARCHIPELAGO);
  const replay = new Replay(ARCHIPELAGO);
  replay.load();
  const { graph } = replay.view();
  const copy = structuredClone({ nodes: graph.nodes, edges: graph.edges });

  stepAll(replay);
  replay.reset();
  assert.deepEqual(ARCHIPELAGO, source);
  assert.deepEqual({ nodes: replay.view().graph.nodes, edges: replay.view().graph.edges }, copy);
});
