import { deepFreeze } from './freeze.js';
import { compareIds } from './ids.js';

function addSorted(list, id) {
  if (!list.includes(id)) {
    list.push(id);
    list.sort(compareIds);
  }
}

export function initialSnapshot(graph) {
  return deepFreeze({
    nodes: Object.fromEntries(graph.nodeIds.map((id) => [id, { parent: null, discovery: null, low: null }])),
    edges: Object.fromEntries(graph.edgeIds.map((id) => [id, 'unvisited'])),
    componentCount: 0,
    bridges: [],
    articulations: [],
  });
}

// Runs the whole search up front. See docs/EVENTS.md for the event schema and emission order.
export function runLowLink(graph) {
  const state = structuredClone(initialSnapshot(graph));
  const events = [];
  const discoveryOrder = [];
  let clock = 0;

  const emit = (type, fields) => {
    events.push(deepFreeze({ seq: events.length, type, edge: null, ...fields, snapshot: structuredClone(state) }));
  };

  const finishChild = (u, v, edge, isRoot) => {
    const node = state.nodes[u];
    const childLow = state.nodes[v].low;
    const parentDiscovery = node.discovery;

    const lowBefore = node.low;
    node.low = Math.min(lowBefore, childLow);
    emit('return', { node: u, child: v, edge, from: v, to: u, childLow, lowBefore, lowAfter: node.low });

    const isBridge = childLow > parentDiscovery;
    if (isBridge) {
      state.edges[edge] = 'bridge';
      addSorted(state.bridges, edge);
    }
    emit('bridge-check', { node: u, child: v, edge, childLow, parentDiscovery, isBridge });

    if (!isRoot) {
      const isArticulation = childLow >= parentDiscovery;
      if (isArticulation) addSorted(state.articulations, u);
      emit('articulation-check', { node: u, child: v, edge, childLow, parentDiscovery, isArticulation });
    }
  };

  const visit = (u, parent, arrivalEdge) => {
    const node = state.nodes[u];
    node.parent = parent;
    node.discovery = clock;
    node.low = clock;
    clock += 1;
    discoveryOrder.push(u);
    emit('discover', {
      node: u,
      edge: arrivalEdge,
      parent,
      discovery: node.discovery,
      low: node.low,
      component: state.componentCount,
    });

    let childCount = 0;
    for (const { neighbour: v, edge } of graph.neighbours(u)) {
      const inspection = { node: u, neighbour: v, edge, from: u, to: v };
      if (state.nodes[v].discovery === null) {
        childCount += 1;
        state.edges[edge] = 'tree';
        emit('inspect', { ...inspection, kind: 'tree' });
        visit(v, u, edge);
        finishChild(u, v, edge, parent === null);
      } else if (v === parent) {
        emit('inspect', { ...inspection, kind: 'parent' });
      } else {
        // Discovery, not low: following the neighbour's own low would claim a route the neighbour alone provides.
        const neighbourDiscovery = state.nodes[v].discovery;
        const lowBefore = node.low;
        node.low = Math.min(lowBefore, neighbourDiscovery);
        state.edges[edge] = 'non-tree';
        emit('inspect', { ...inspection, kind: 'visited', neighbourDiscovery, lowBefore, lowAfter: node.low });
      }
    }

    if (parent === null) {
      const isArticulation = childCount >= 2;
      if (isArticulation) addSorted(state.articulations, u);
      emit('root-check', { node: u, childCount, isArticulation });
    }
    emit('node-complete', { node: u, discovery: node.discovery, low: node.low });
  };

  for (const root of graph.nodeIds) {
    if (state.nodes[root].discovery === null) {
      state.componentCount += 1;
      const clockAtStart = clock;
      visit(root, null, null);
      emit('component-complete', { node: root, component: state.componentCount, size: clock - clockAtStart });
    }
  }

  const result = deepFreeze({
    discoveryOrder,
    table: graph.nodeIds.map((id) => ({ id, ...state.nodes[id] })),
    componentCount: state.componentCount,
    bridges: state.bridges,
    articulations: state.articulations,
  });
  return { events, result };
}
