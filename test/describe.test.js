import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MIXED } from '../fixtures/graphs.js';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { Replay } from '../src/replay.js';
import { describeEvent, summaryProofs } from '../src/ui/describe.js';

const finished = (source = ARCHIPELAGO) => {
  const replay = new Replay(source);
  replay.load();
  replay.runToEnd();
  return replay.view();
};

const findEvent = (view, match) => view.history.find((event) => Object.entries(match).every(([key, value]) => event[key] === value));

test('every event has a heading, a plain-language text and a stated change', () => {
  for (const source of [ARCHIPELAGO, MIXED]) {
    const view = finished(source);
    for (const event of view.history) {
      const { heading, text, change } = describeEvent(event, view.graph);
      for (const part of [heading, text, change]) assert.ok(part.length > 0, `${event.type}: empty description`);
    }
  }
});

test('a low update states the old value, the new value and the formula', () => {
  const view = finished();
  const event = findEvent(view, { type: 'inspect', from: 'FLAG', to: 'DOUBLOON' });
  const { change } = describeEvent(event, view.graph);
  assert.equal(change, 'low[FLAG]: 5 → 3, from min(5, discovery[DOUBLOON] = 3)');
});

test('a low value that does not change says so', () => {
  const view = finished();
  const event = findEvent(view, { type: 'inspect', from: 'DOUBLOON', to: 'FLAG' });
  assert.equal(describeEvent(event, view.graph).change, 'low[DOUBLOON] stays 3, from min(3, discovery[FLAG] = 5)');
});

test('a return states the change it caused', () => {
  const view = finished();
  const event = findEvent(view, { type: 'return', from: 'FLAG', to: 'EMERALD' });
  assert.equal(describeEvent(event, view.graph).change, 'low[EMERALD]: 4 → 3, from min(4, low[FLAG] = 3)');
});

test('B04 and B05 explain the strict bridge rule with their numbers', () => {
  const view = finished();
  const b04 = describeEvent(findEvent(view, { type: 'bridge-check', edge: 'B04' }), view.graph);
  assert.equal(b04.heading, 'B04 is a critical bridge');
  assert.equal(b04.change, 'low[DOUBLOON] = 3 > discovery[COMPASS] = 2: true');

  const b05 = describeEvent(findEvent(view, { type: 'bridge-check', edge: 'B05' }), view.graph);
  assert.equal(b05.heading, 'B05 is not a critical bridge');
  assert.equal(b05.change, 'low[EMERALD] = 3 > discovery[DOUBLOON] = 3: false');
});

test('DOUBLOON explains the non-root articulation rule, including equality', () => {
  const view = finished();
  const event = findEvent(view, { type: 'articulation-check', node: 'DOUBLOON' });
  const { heading, change } = describeEvent(event, view.graph);
  assert.equal(heading, 'DOUBLOON is an articulation island');
  assert.equal(change, 'low[EMERALD] = 3 >= discovery[DOUBLOON] = 3: true');
});

test('the root check states the child count against the rule', () => {
  const main = finished();
  const anchor = describeEvent(findEvent(main, { type: 'root-check' }), main.graph);
  assert.equal(anchor.heading, 'ANCHOR is not an articulation island');
  assert.equal(anchor.change, '1 >= 2: false');
  assert.match(anchor.text, /1 DFS child\./);

  const mixed = finished(MIXED);
  const root = describeEvent(findEvent(mixed, { type: 'root-check', node: 'A' }), mixed.graph);
  assert.equal(root.heading, 'A is an articulation island');
  assert.equal(root.change, '2 >= 2: true');
  assert.match(root.text, /2 DFS children/);
});

test('events that change no values say so', () => {
  const view = finished();
  const tree = findEvent(view, { type: 'inspect', kind: 'tree' });
  const parent = findEvent(view, { type: 'inspect', kind: 'parent' });
  assert.equal(describeEvent(tree, view.graph).change, 'No values change.');
  assert.equal(describeEvent(parent, view.graph).change, 'No values change.');
});

test('the summary gives the numbers behind each critical item', () => {
  assert.deepEqual(summaryProofs(finished()), {
    bridges: [
      { id: 'B04', proof: 'low[DOUBLOON] = 3 > discovery[COMPASS] = 2' },
      { id: 'B08', proof: 'low[GULL] = 6 > discovery[FLAG] = 5' },
      { id: 'B09', proof: 'low[HOOK] = 7 > discovery[GULL] = 6' },
    ],
    articulations: [
      { id: 'COMPASS', proof: 'low[DOUBLOON] = 3 >= discovery[COMPASS] = 2' },
      { id: 'DOUBLOON', proof: 'low[EMERALD] = 3 >= discovery[DOUBLOON] = 3' },
      { id: 'FLAG', proof: 'low[GULL] = 6 >= discovery[FLAG] = 5' },
      { id: 'GULL', proof: 'low[HOOK] = 7 >= discovery[GULL] = 6' },
    ],
  });
});

test('the summary gives a root articulation island its own proof', () => {
  assert.deepEqual(summaryProofs(finished(MIXED)).articulations, [{ id: 'A', proof: 'root with 2 DFS children' }]);
});

test('the summary only lists what the replay has proved so far', () => {
  const replay = new Replay(ARCHIPELAGO);
  replay.load();
  assert.deepEqual(summaryProofs(replay.view()), { bridges: [], articulations: [] });

  // Event 27 proves the first bridge. Event 28 proves the first articulation island.
  for (let i = 0; i < 27; i++) replay.step();
  assert.deepEqual(summaryProofs(replay.view()), {
    bridges: [{ id: 'B09', proof: 'low[HOOK] = 7 > discovery[GULL] = 6' }],
    articulations: [],
  });
});
