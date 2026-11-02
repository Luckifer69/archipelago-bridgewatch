import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BOWTIE,
  CYCLE,
  EXPECTED_BOWTIE,
  EXPECTED_CYCLE,
  EXPECTED_MAIN,
  EXPECTED_MIXED,
  MIXED,
  seededShuffle,
} from '../fixtures/graphs.js';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { GraphState } from '../src/engine/graphState.js';
import { runLowLink } from '../src/engine/lowlink.js';

const analyse = (input) => runLowLink(new GraphState(input));
const row = (result, id) => result.table.find((entry) => entry.id === id);

const graph = (ids, edges = []) => ({
  nodes: ids.map((id) => ({ id, name: id, x: 50, y: 50 })),
  edges: edges.map(([id, a, b]) => ({ id, a, b })),
});

test('main archipelago matches the documented values', () => {
  assert.deepEqual(analyse(ARCHIPELAGO), EXPECTED_MAIN);
});

test('the main archipelago contains everything the brief requires', () => {
  const result = analyse(ARCHIPELAGO);
  assert.equal(result.componentCount, 1, 'connected');
  assert.ok(result.bridges.length >= 1, 'has a bridge');
  assert.ok(ARCHIPELAGO.edges.some((edge) => !result.bridges.includes(edge.id)), 'has a cycle edge that is not a bridge');
  assert.ok(result.articulations.some((id) => row(result, id).parent !== null), 'has a non-root articulation point');
});

test('cycle only: no bridges and no articulation islands', () => {
  assert.deepEqual(analyse(CYCLE), EXPECTED_CYCLE);
});

test('mixed: root with two children, an isolated island and a separate component', () => {
  assert.deepEqual(analyse(MIXED), EXPECTED_MIXED);
});

test('reversed and shuffled source arrays give the same values', () => {
  const { nodes, edges } = ARCHIPELAGO;
  assert.deepEqual(analyse({ nodes: [...nodes].reverse(), edges: [...edges].reverse() }), EXPECTED_MAIN);
  for (const seed of [1, 7, 42, 2024, 99991]) {
    assert.deepEqual(analyse({ nodes: seededShuffle(nodes, seed), edges: seededShuffle(edges, seed + 1) }), EXPECTED_MAIN);
  }
  assert.deepEqual(analyse({ nodes: seededShuffle(MIXED.nodes, 5), edges: seededShuffle(MIXED.edges, 6) }), EXPECTED_MIXED);
});

test('swapping which end of a bridge is listed first changes nothing', () => {
  const edges = ARCHIPELAGO.edges.map(({ id, a, b }) => ({ id, a: b, b: a }));
  assert.deepEqual(analyse({ nodes: ARCHIPELAGO.nodes, edges }), EXPECTED_MAIN);
});

test('moving an island never changes the traversal or results', () => {
  const nodes = ARCHIPELAGO.nodes.map((node, i) => ({ ...node, x: 100 - i * 10, y: i * 5 }));
  assert.deepEqual(analyse({ nodes, edges: ARCHIPELAGO.edges }), EXPECTED_MAIN);
});

test('a back connection uses the neighbour discovery value, not its low value', () => {
  // low[C] is 0 by the time E looks back at C, and discovery[C] is 2.
  const result = analyse(BOWTIE);
  assert.deepEqual(result, EXPECTED_BOWTIE);
  assert.equal(row(result, 'E').low, 2);
  assert.equal(row(result, 'D').low, 2);
  assert.ok(result.articulations.includes('C'));
});

test('a low value found by a back connection propagates up through returns', () => {
  // COMPASS finds ANCHOR over B03, and BARREL only learns of it when COMPASS returns.
  assert.equal(row(analyse(ARCHIPELAGO), 'COMPASS').low, 0);
  assert.equal(row(analyse(ARCHIPELAGO), 'BARREL').low, 0);
});

test('the parent connection does not count as a back connection', () => {
  const result = analyse(graph(['A', 'B'], [['E1', 'A', 'B']]));
  assert.equal(row(result, 'B').low, 1);
  assert.deepEqual(result.bridges, ['E1']);
});

test('bridge rule is strict: low[child] equal to discovery[parent] is not a bridge', () => {
  const main = analyse(ARCHIPELAGO);
  assert.equal(row(main, 'EMERALD').low, row(main, 'DOUBLOON').discovery);
  assert.ok(!main.bridges.includes('B05'));

  assert.ok(row(main, 'DOUBLOON').low > row(main, 'COMPASS').discovery);
  assert.ok(main.bridges.includes('B04'));
});

test('non-root articulation rule includes equality', () => {
  const main = analyse(ARCHIPELAGO);
  assert.equal(row(main, 'EMERALD').low, row(main, 'DOUBLOON').discovery);
  assert.ok(main.articulations.includes('DOUBLOON'));

  // Inside a plain loop, low[child] is below discovery[parent], so there is no articulation island.
  assert.ok(!main.articulations.includes('EMERALD'));
  assert.ok(!main.articulations.includes('BARREL'));
});

test('a root with one DFS child is not an articulation island, even when the non-root rule would pass', () => {
  const path = analyse(graph(['A', 'B', 'C'], [['E1', 'A', 'B'], ['E2', 'B', 'C']]));
  assert.deepEqual(path.articulations, ['B']);
  assert.ok(!analyse(ARCHIPELAGO).articulations.includes('ANCHOR'));
});

test('a root with two or more DFS children is an articulation island', () => {
  const star = analyse(graph(['A', 'B', 'C', 'D'], [['E1', 'A', 'B'], ['E2', 'A', 'C'], ['E3', 'A', 'D']]));
  assert.deepEqual(star.articulations, ['A']);
  assert.deepEqual(star.bridges, ['E1', 'E2', 'E3']);
});

test('a root whose neighbours join in a loop has only one DFS child', () => {
  const triangle = analyse(graph(['A', 'B', 'C'], [['E1', 'A', 'B'], ['E2', 'B', 'C'], ['E3', 'A', 'C']]));
  assert.deepEqual(triangle.articulations, []);
  assert.deepEqual(triangle.bridges, []);
});

test('an island that qualifies through two children is listed once', () => {
  const result = analyse(graph(['A', 'B', 'C', 'D'], [['E1', 'A', 'B'], ['E2', 'B', 'C'], ['E3', 'B', 'D']]));
  assert.deepEqual(result.articulations, ['B']);
});

test('roots are chosen in ascending ID order and one clock runs across components', () => {
  const result = analyse(graph(['Z', 'M', 'A']));
  assert.deepEqual(result.discoveryOrder, ['A', 'M', 'Z']);
  assert.deepEqual(result.table.map((entry) => [entry.id, entry.discovery]), [['A', 0], ['M', 1], ['Z', 2]]);
  assert.equal(result.componentCount, 3);
});

test('a lower-ID island in a later position still roots first', () => {
  const result = analyse(graph(['P', 'Q', 'B', 'C'], [['E1', 'P', 'Q'], ['E2', 'B', 'C']]));
  assert.deepEqual(result.discoveryOrder, ['B', 'C', 'P', 'Q']);
  assert.equal(row(result, 'P').discovery, 2);
  assert.equal(row(result, 'P').parent, null);
});

test('critical results sort in ASCII order, not locale or numeric order', () => {
  const ids = ['N1', 'N2', 'N3', 'N4', 'N5'];
  const edges = [['B9', 'N1', 'N2'], ['B10', 'N2', 'N3'], ['B_1', 'N3', 'N4'], ['B-2', 'N4', 'N5']];
  assert.deepEqual(analyse(graph(ids, edges)).bridges, ['B-2', 'B10', 'B9', 'B_1']);

  const chain = analyse(graph(['A_1', 'AA', 'A-1', 'A1'], [['E1', 'A-1', 'A1'], ['E2', 'A1', 'AA'], ['E3', 'AA', 'A_1']]));
  assert.deepEqual(chain.discoveryOrder, ['A-1', 'A1', 'AA', 'A_1']);
  assert.deepEqual(chain.articulations, ['A1', 'AA']);
});

test('a single island has no critical items', () => {
  const result = analyse(graph(['SOLO']));
  assert.deepEqual(result.table, [{ id: 'SOLO', parent: null, discovery: 0, low: 0 }]);
  assert.equal(result.componentCount, 1);
  assert.deepEqual(result.bridges, []);
  assert.deepEqual(result.articulations, []);
});

// Works out critical items by removal alone, with no low-link logic.
function bruteForce({ nodes, edges }) {
  const ids = nodes.map((node) => node.id);
  const countComponents = (keptIds, keptEdges) => {
    const seen = new Set();
    let count = 0;
    for (const start of keptIds) {
      if (seen.has(start)) continue;
      count += 1;
      const stack = [start];
      while (stack.length > 0) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of keptEdges) {
          if (edge.a === id) stack.push(edge.b);
          if (edge.b === id) stack.push(edge.a);
        }
      }
    }
    return count;
  };

  const base = countComponents(ids, edges);
  const bridges = edges.filter((edge) => countComponents(ids, edges.filter((e) => e !== edge)) > base).map((edge) => edge.id);
  const articulations = ids.filter((id) => {
    const kept = edges.filter((edge) => edge.a !== id && edge.b !== id);
    const isolated = kept.length === edges.length;
    return countComponents(ids.filter((other) => other !== id), kept) > base - (isolated ? 1 : 0);
  });
  return { base, bridges: bridges.sort(), articulations: articulations.sort() };
}

test('500 repeatable random graphs agree with brute-force removal', () => {
  let state = 12345;
  const next = (limit) => {
    state = (state * 16807) % 2147483647;
    return state % limit;
  };

  for (let run = 0; run < 500; run++) {
    const count = 1 + next(12);
    const ids = Array.from({ length: count }, (_, i) => `N${String(i).padStart(2, '0')}`);
    const edges = [];
    const pairs = new Set();
    const target = next(21);
    for (let attempt = 0; attempt < target * 3 && edges.length < target && count > 1; attempt++) {
      const [a, b] = [ids[next(count)], ids[next(count)]];
      const pair = [a, b].sort().join('|');
      if (a !== b && !pairs.has(pair)) {
        pairs.add(pair);
        edges.push([`E${String(edges.length).padStart(2, '0')}`, a, b]);
      }
    }

    const input = graph(ids, edges);
    const result = analyse(input);
    const expected = bruteForce(input);
    assert.deepEqual(
      { base: result.componentCount, bridges: result.bridges, articulations: result.articulations },
      expected,
      `run ${run}: ${JSON.stringify(edges)}`,
    );
  }
});
