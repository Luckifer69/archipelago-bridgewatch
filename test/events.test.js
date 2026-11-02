import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOWTIE, CYCLE, MIXED, seededShuffle } from '../fixtures/graphs.js';
import { ARCHIPELAGO } from '../src/archipelago/index.js';
import { GraphState } from '../src/engine/graphState.js';
import { initialSnapshot, runLowLink } from '../src/engine/lowlink.js';

const run = (input) => runLowLink(new GraphState(input));
const yesNo = (value) => (value ? 'yes' : 'no');

function summarise(event) {
  switch (event.type) {
    case 'discover':
      return `discover ${event.node} from ${event.parent ?? 'root'} ${event.discovery}/${event.low}`;
    case 'inspect': {
      const values = event.kind === 'visited' ? ` ${event.lowBefore}>${event.lowAfter}` : '';
      return `inspect ${event.from} ${event.to} ${event.edge} ${event.kind}${values}`;
    }
    case 'return':
      return `return ${event.from} ${event.to} ${event.edge} ${event.lowBefore}>${event.lowAfter}`;
    case 'bridge-check':
      return `bridge-check ${event.edge} ${event.childLow}>${event.parentDiscovery} ${yesNo(event.isBridge)}`;
    case 'articulation-check':
      return `articulation-check ${event.node} ${event.childLow}>=${event.parentDiscovery} ${yesNo(event.isArticulation)}`;
    case 'root-check':
      return `root-check ${event.node} ${event.childCount} ${yesNo(event.isArticulation)}`;
    case 'node-complete':
      return `node-complete ${event.node} ${event.low}`;
    case 'component-complete':
      return `component-complete ${event.component} ${event.size}`;
    default:
      throw new Error(`Unknown event type ${event.type}`);
  }
}

// Typed from the hand-derived table in docs/EVENTS.md.
const MAIN_SEQUENCE = [
  'discover ANCHOR from root 0/0',
  'inspect ANCHOR BARREL B01 tree',
  'discover BARREL from ANCHOR 1/1',
  'inspect BARREL ANCHOR B01 parent',
  'inspect BARREL COMPASS B02 tree',
  'discover COMPASS from BARREL 2/2',
  'inspect COMPASS ANCHOR B03 visited 2>0',
  'inspect COMPASS BARREL B02 parent',
  'inspect COMPASS DOUBLOON B04 tree',
  'discover DOUBLOON from COMPASS 3/3',
  'inspect DOUBLOON COMPASS B04 parent',
  'inspect DOUBLOON EMERALD B05 tree',
  'discover EMERALD from DOUBLOON 4/4',
  'inspect EMERALD DOUBLOON B05 parent',
  'inspect EMERALD FLAG B06 tree',
  'discover FLAG from EMERALD 5/5',
  'inspect FLAG DOUBLOON B07 visited 5>3',
  'inspect FLAG EMERALD B06 parent',
  'inspect FLAG GULL B08 tree',
  'discover GULL from FLAG 6/6',
  'inspect GULL FLAG B08 parent',
  'inspect GULL HOOK B09 tree',
  'discover HOOK from GULL 7/7',
  'inspect HOOK GULL B09 parent',
  'node-complete HOOK 7',
  'return HOOK GULL B09 6>6',
  'bridge-check B09 7>6 yes',
  'articulation-check GULL 7>=6 yes',
  'node-complete GULL 6',
  'return GULL FLAG B08 3>3',
  'bridge-check B08 6>5 yes',
  'articulation-check FLAG 6>=5 yes',
  'node-complete FLAG 3',
  'return FLAG EMERALD B06 4>3',
  'bridge-check B06 3>4 no',
  'articulation-check EMERALD 3>=4 no',
  'node-complete EMERALD 3',
  'return EMERALD DOUBLOON B05 3>3',
  'bridge-check B05 3>3 no',
  'articulation-check DOUBLOON 3>=3 yes',
  'inspect DOUBLOON FLAG B07 visited 3>3',
  'node-complete DOUBLOON 3',
  'return DOUBLOON COMPASS B04 0>0',
  'bridge-check B04 3>2 yes',
  'articulation-check COMPASS 3>=2 yes',
  'node-complete COMPASS 0',
  'return COMPASS BARREL B02 1>0',
  'bridge-check B02 0>1 no',
  'articulation-check BARREL 0>=1 no',
  'node-complete BARREL 0',
  'return BARREL ANCHOR B01 0>0',
  'bridge-check B01 0>0 no',
  'inspect ANCHOR COMPASS B03 visited 0>0',
  'root-check ANCHOR 1 no',
  'node-complete ANCHOR 0',
  'component-complete 1 8',
];

test('the main archipelago emits exactly the documented 56-event sequence', () => {
  assert.deepEqual(run(ARCHIPELAGO).events.map(summarise), MAIN_SEQUENCE);
});

test('the main archipelago emits the documented number of each event type', () => {
  const counts = {};
  for (const { type } of run(ARCHIPELAGO).events) counts[type] = (counts[type] ?? 0) + 1;
  assert.deepEqual(counts, {
    discover: 8,
    inspect: 18,
    return: 7,
    'bridge-check': 7,
    'articulation-check': 6,
    'root-check': 1,
    'node-complete': 8,
    'component-complete': 1,
  });
});

test('an isolated island emits discover, root check, node complete and component complete', () => {
  const { events } = run({ nodes: [{ id: 'SOLO', name: 'Solo', x: 1, y: 1 }], edges: [] });
  assert.deepEqual(events.map(summarise), [
    'discover SOLO from root 0/0',
    'root-check SOLO 0 no',
    'node-complete SOLO 0',
    'component-complete 1 1',
  ]);
});

test('the mixed graph emits events component by component, with one running clock', () => {
  const { events } = run(MIXED);
  assert.deepEqual(events.filter((event) => event.type === 'discover').map((event) => [event.node, event.discovery, event.component]), [
    ['A', 0, 1],
    ['B', 1, 1],
    ['C', 2, 1],
    ['D', 3, 2],
    ['E', 4, 3],
    ['F', 5, 3],
    ['G', 6, 3],
  ]);
  assert.deepEqual(events.filter((event) => event.type === 'component-complete').map((event) => [event.node, event.component, event.size]), [
    ['A', 1, 3],
    ['D', 2, 1],
    ['E', 3, 3],
  ]);
  assert.deepEqual(events.filter((event) => event.type === 'root-check').map(summarise), [
    'root-check A 2 yes',
    'root-check D 0 no',
    'root-check E 1 no',
  ]);
});

for (const [name, input] of Object.entries({ ARCHIPELAGO, CYCLE, MIXED, BOWTIE })) {
  test(`${name}: every bridge is inspected exactly twice, once from each end`, () => {
    const { events } = run(input);
    const inspections = events.filter((event) => event.type === 'inspect');
    assert.equal(inspections.length, input.edges.length * 2);
    for (const { id, a, b } of input.edges) {
      const ends = inspections.filter((event) => event.edge === id).map((event) => event.from).sort();
      assert.deepEqual(ends, [a, b].sort(), id);
    }
  });

  test(`${name}: a return is followed by its bridge check, then an articulation check unless the parent is a root`, () => {
    const { events } = run(input);
    events.forEach((event, i) => {
      if (event.type !== 'return') return;
      const check = events[i + 1];
      assert.equal(check.type, 'bridge-check');
      assert.equal(check.edge, event.edge);
      assert.equal(check.child, event.child);

      const isRoot = event.snapshot.nodes[event.node].parent === null;
      if (isRoot) {
        assert.notEqual(events[i + 2].type, 'articulation-check');
      } else {
        assert.equal(events[i + 2].type, 'articulation-check');
        assert.equal(events[i + 2].child, event.child);
      }
    });
  });

  test(`${name}: each event's stated change matches the snapshots before and after it`, () => {
    const graph = new GraphState(input);
    const { events } = runLowLink(graph);

    events.forEach((event, i) => {
      assert.equal(event.seq, i);
      const before = i === 0 ? initialSnapshot(graph) : events[i - 1].snapshot;
      const after = event.snapshot;

      // Only the island named by an event may change, and only events that state a change may change it.
      for (const id of graph.nodeIds) {
        if (id !== event.node) assert.deepEqual(after.nodes[id], before.nodes[id], `${summarise(event)}: ${id} changed`);
      }

      switch (event.type) {
        case 'discover':
          assert.equal(before.nodes[event.node].discovery, null);
          assert.deepEqual(after.nodes[event.node], { parent: event.parent, discovery: event.discovery, low: event.low });
          assert.equal(event.discovery, event.low);
          break;
        case 'inspect':
          if (event.kind === 'visited') {
            assert.equal(before.nodes[event.node].low, event.lowBefore);
            assert.equal(after.nodes[event.node].low, event.lowAfter);
            assert.equal(event.lowAfter, Math.min(event.lowBefore, before.nodes[event.neighbour].discovery));
            assert.equal(event.neighbourDiscovery, before.nodes[event.neighbour].discovery);
            assert.equal(after.edges[event.edge], 'non-tree');
          } else {
            assert.deepEqual(after.nodes[event.node], before.nodes[event.node]);
            if (event.kind === 'tree') assert.equal(after.edges[event.edge], 'tree');
            if (event.kind === 'parent') assert.deepEqual(after.edges, before.edges);
          }
          break;
        case 'return':
          assert.equal(before.nodes[event.node].low, event.lowBefore);
          assert.equal(after.nodes[event.node].low, event.lowAfter);
          assert.equal(event.childLow, after.nodes[event.child].low);
          assert.equal(event.lowAfter, Math.min(event.lowBefore, event.childLow));
          break;
        case 'bridge-check':
          assert.deepEqual(after.nodes, before.nodes);
          assert.equal(event.isBridge, event.childLow > event.parentDiscovery);
          assert.equal(event.parentDiscovery, after.nodes[event.node].discovery);
          assert.equal(after.bridges.includes(event.edge), event.isBridge);
          assert.equal(after.edges[event.edge], event.isBridge ? 'bridge' : 'tree');
          assert.equal(after.bridges.length - before.bridges.length, event.isBridge ? 1 : 0);
          break;
        case 'articulation-check':
          assert.deepEqual(after.nodes, before.nodes);
          assert.equal(event.isArticulation, event.childLow >= event.parentDiscovery);
          if (event.isArticulation) assert.ok(after.articulations.includes(event.node));
          break;
        case 'root-check':
          assert.deepEqual(after.nodes, before.nodes);
          assert.equal(after.nodes[event.node].parent, null);
          assert.equal(event.isArticulation, event.childCount >= 2);
          assert.equal(after.articulations.includes(event.node), event.isArticulation);
          break;
        default:
          assert.deepEqual(after, before, `${event.type} changes nothing`);
      }
    });
  });

  test(`${name}: the last snapshot matches the final result`, () => {
    const { events, result } = run(input);
    const last = events.at(-1).snapshot;
    assert.deepEqual(result.table, Object.keys(last.nodes).map((id) => ({ id, ...last.nodes[id] })));
    assert.equal(result.componentCount, last.componentCount);
    assert.deepEqual(result.bridges, last.bridges);
    assert.deepEqual(result.articulations, last.articulations);
  });

  test(`${name}: repeated runs and shuffled input give an identical event history`, () => {
    const expected = run(input).events;
    assert.deepEqual(run(input).events, expected);
    assert.deepEqual(run({ nodes: [...input.nodes].reverse(), edges: [...input.edges].reverse() }).events, expected);
    for (const seed of [3, 11, 2024]) {
      assert.deepEqual(run({ nodes: seededShuffle(input.nodes, seed), edges: seededShuffle(input.edges, seed + 1) }).events, expected);
    }
  });
}

test('the final map state gives each bridge its documented status', () => {
  const { edges } = run(ARCHIPELAGO).events.at(-1).snapshot;
  assert.deepEqual(edges, {
    B01: 'tree',
    B02: 'tree',
    B03: 'non-tree',
    B04: 'bridge',
    B05: 'tree',
    B06: 'tree',
    B07: 'non-tree',
    B08: 'bridge',
    B09: 'bridge',
  });
});

test('critical items appear only when the event that proves them is reached', () => {
  const { events } = run(ARCHIPELAGO);
  const firstBridge = events.findIndex((event) => event.snapshot.bridges.length > 0);
  assert.equal(summarise(events[firstBridge]), 'bridge-check B09 7>6 yes');
  const firstArticulation = events.findIndex((event) => event.snapshot.articulations.length > 0);
  assert.equal(summarise(events[firstArticulation]), 'articulation-check GULL 7>=6 yes');
});

test('snapshots are independent and read-only, so earlier ones keep their values', () => {
  const { events } = run(ARCHIPELAGO);
  assert.deepEqual(events[0].snapshot.nodes.HOOK, { parent: null, discovery: null, low: null });
  assert.equal(events[0].snapshot.nodes.ANCHOR.low, 0);
  assert.deepEqual(events[0].snapshot.bridges, []);
  assert.throws(() => { events[0].snapshot.nodes.ANCHOR.low = 9; }, TypeError);
  assert.throws(() => { events.at(-1).snapshot.bridges.pop(); }, TypeError);
});

test('the snapshot before the first event shows everything unvisited', () => {
  const start = initialSnapshot(new GraphState(CYCLE));
  assert.deepEqual(start, {
    nodes: {
      A: { parent: null, discovery: null, low: null },
      B: { parent: null, discovery: null, low: null },
      C: { parent: null, discovery: null, low: null },
      D: { parent: null, discovery: null, low: null },
    },
    edges: { E1: 'unvisited', E2: 'unvisited', E3: 'unvisited', E4: 'unvisited' },
    componentCount: 0,
    bridges: [],
    articulations: [],
  });
});
