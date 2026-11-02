import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { GraphState } from '../src/engine/graphState.js';
import { runLowLink } from '../src/engine/lowlink.js';
import { animationPlan, markerPosition, PULSE_MS, TRAVEL_MS } from '../src/ui/animationPlan.js';

const { events } = runLowLink(new GraphState(ARCHIPELAGO));
const find = (match) => events.find((event) => Object.entries(match).every(([key, value]) => event[key] === value));

test('a new bridge: the marker travels along it and draws a solid line', () => {
  assert.deepEqual(animationPlan(find({ type: 'inspect', kind: 'tree', edge: 'B04' })), {
    kind: 'travel',
    from: 'COMPASS',
    to: 'DOUBLOON',
    draw: 'solid',
    durationMs: 600,
  });
});

test('an already-visited connection: the marker goes there and back on a dashed line', () => {
  assert.deepEqual(animationPlan(find({ type: 'inspect', kind: 'visited', from: 'FLAG' })), {
    kind: 'there-and-back',
    from: 'FLAG',
    to: 'DOUBLOON',
    draw: 'dashed',
    durationMs: 600,
  });
});

test('a return: the marker travels from child back to parent, with no line drawn', () => {
  assert.deepEqual(animationPlan(find({ type: 'return', edge: 'B04' })), {
    kind: 'travel',
    from: 'DOUBLOON',
    to: 'COMPASS',
    draw: 'none',
    durationMs: 600,
  });
});

test('a look back at the parent and a bridge check pulse the bridge, with no travel', () => {
  assert.deepEqual(animationPlan(find({ type: 'inspect', kind: 'parent', edge: 'B01' })), { kind: 'pulse-edge', edge: 'B01', durationMs: 250 });
  assert.deepEqual(animationPlan(find({ type: 'bridge-check', edge: 'B04' })), { kind: 'pulse-edge', edge: 'B04', durationMs: 250 });
});

test('all other events pulse their island', () => {
  for (const type of ['discover', 'articulation-check', 'root-check', 'node-complete', 'component-complete']) {
    const event = find({ type });
    assert.deepEqual(animationPlan(event), { kind: 'pulse-island', node: event.node, durationMs: 250 }, type);
  }
});

test('the demo takes about 20 seconds to play through', () => {
  const total = events.reduce((sum, event) => sum + animationPlan(event).durationMs, 0);
  assert.equal(total, 18 * TRAVEL_MS + 38 * PULSE_MS);
  assert.equal(total, 20300);
});

test('the marker starts at one end and finishes at the other', () => {
  const plan = { kind: 'travel' };
  const [from, to] = [{ x: 0, y: 0 }, { x: 10, y: 20 }];
  assert.deepEqual(markerPosition(plan, from, to, 0), from);
  assert.deepEqual(markerPosition(plan, from, to, 0.5), { x: 5, y: 10 });
  assert.deepEqual(markerPosition(plan, from, to, 1), to);
});

test('there and back reaches the far end halfway through and returns to the start', () => {
  const plan = { kind: 'there-and-back' };
  const [from, to] = [{ x: 0, y: 0 }, { x: 10, y: 20 }];
  assert.deepEqual(markerPosition(plan, from, to, 0), from);
  assert.deepEqual(markerPosition(plan, from, to, 0.5), to);
  assert.deepEqual(markerPosition(plan, from, to, 1), from);
});

test('planning an animation changes nothing in the event list', () => {
  const before = structuredClone(events);
  events.forEach(animationPlan);
  assert.deepEqual(events, before);
});
