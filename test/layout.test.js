import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { seededShuffle } from '../fixtures/graphs.js';
import { computeLayout, formatPositions, orient, rescale } from '../scripts/layout.js';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { POSITIONS } from '../src/archipelago/positions.js';
import { BRIDGES, ISLANDS } from '../src/archipelago/topology.js';

test('repeat runs give identical positions', () => {
  assert.deepEqual(computeLayout(ISLANDS, BRIDGES), computeLayout(ISLANDS, BRIDGES));
});

test('shuffled and reversed input give identical positions', () => {
  const expected = computeLayout(ISLANDS, BRIDGES);
  assert.deepEqual(computeLayout([...ISLANDS].reverse(), [...BRIDGES].reverse()), expected);
  for (const seed of [1, 7, 42, 2024]) {
    assert.deepEqual(computeLayout(seededShuffle(ISLANDS, seed), seededShuffle(BRIDGES, seed)), expected);
  }
});

test('saved positions match what the script generates', () => {
  const saved = readFileSync(new URL('../src/archipelago/positions.js', import.meta.url), 'utf8');
  assert.equal(saved.replace(/\r\n/g, '\n'), formatPositions(computeLayout(ISLANDS, BRIDGES)));
});

test('every island has a position inside the valid range', () => {
  assert.equal(ARCHIPELAGO.nodes.length, 8);
  for (const node of ARCHIPELAGO.nodes) {
    assert.ok(node.x >= 0 && node.x <= 100, `${node.id} x = ${node.x}`);
    assert.ok(node.y >= 0 && node.y <= 100, `${node.id} y = ${node.y}`);
  }
});

test('the saved map is readable: no crossings, and islands keep clear of each other and of other bridges', () => {
  const side = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  for (const [i, e] of BRIDGES.entries()) {
    for (const f of BRIDGES.slice(i + 1)) {
      if (new Set([e.a, e.b, f.a, f.b]).size < 4) continue;
      const [a, b, c, d] = [POSITIONS[e.a], POSITIONS[e.b], POSITIONS[f.a], POSITIONS[f.b]];
      const crosses = side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
      assert.ok(!crosses, `${e.id} crosses ${f.id}`);
    }
  }

  const ids = Object.keys(POSITIONS);
  for (const [i, first] of ids.entries()) {
    for (const second of ids.slice(i + 1)) {
      const distance = Math.hypot(POSITIONS[first].x - POSITIONS[second].x, POSITIONS[first].y - POSITIONS[second].y);
      assert.ok(distance >= 12, `${first} and ${second} are ${distance} apart`);
    }
  }

  for (const id of ids) {
    for (const bridge of BRIDGES) {
      if (bridge.a === id || bridge.b === id) continue;
      const [a, b, p] = [POSITIONS[bridge.a], POSITIONS[bridge.b], POSITIONS[id]];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      const distance = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      assert.ok(distance >= 8, `${id} is ${distance} from ${bridge.id}`);
    }
  }
});

test('rescale offsets each axis, then scales both by one constant into 10 to 90', () => {
  const result = rescale({ A: { x: -60, y: -40 }, B: { x: 20, y: 0 }, C: { x: 100, y: 40 } });
  assert.deepEqual(result, { A: { x: 10, y: 10 }, B: { x: 50, y: 30 }, C: { x: 90, y: 50 } });
});

test('rescale also works when nothing is negative', () => {
  const result = rescale({ A: { x: 200, y: 300 }, B: { x: 400, y: 300 } });
  assert.deepEqual(result, { A: { x: 10, y: 10 }, B: { x: 90, y: 10 } });
});

test('islands sharing one point go to the centre instead of dividing by zero', () => {
  assert.deepEqual(rescale({ A: { x: 5, y: 5 } }), { A: { x: 50, y: 50 } });
  assert.deepEqual(rescale({ A: { x: 5, y: 5 }, B: { x: 5, y: 5 } }), { A: { x: 50, y: 50 }, B: { x: 50, y: 50 } });
  assert.deepEqual(computeLayout([{ id: 'SOLO' }], []), { SOLO: { x: 50, y: 50 } });
});

test('orient makes the map wider than tall, with the first island on the left', () => {
  const oriented = orient({ A: { x: 0, y: 10 }, B: { x: 1, y: 0 } }, 'A');
  assert.deepEqual(oriented, { A: { x: -10, y: 0 }, B: { x: -0, y: 1 } });

  const unchanged = orient({ A: { x: 0, y: 0 }, B: { x: 10, y: 1 } }, 'A');
  assert.deepEqual(unchanged, { A: { x: 0, y: 0 }, B: { x: 10, y: 1 } });
});

test('the browser app never imports the layout library', () => {
  const sources = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter((file) => file.endsWith('.js'));
  assert.ok(sources.length > 0);
  for (const file of sources) {
    const code = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.ok(!code.includes("from 'graphology"), `${file} imports graphology`);
  }
});
