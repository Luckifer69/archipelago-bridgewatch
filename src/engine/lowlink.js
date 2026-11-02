import { deepFreeze } from './freeze.js';
import { compareIds } from './ids.js';

function addSorted(list, id) {
  if (!list.includes(id)) {
    list.push(id);
    list.sort(compareIds);
  }
}

export function runLowLink(graph) {
  const nodes = Object.fromEntries(graph.nodeIds.map((id) => [id, { parent: null, discovery: null, low: null }]));
  const bridges = [];
  const articulations = [];
  const discoveryOrder = [];
  let componentCount = 0;
  let clock = 0;

  const finishChild = (u, v, edge, isRoot) => {
    const node = nodes[u];
    const child = nodes[v];
    node.low = Math.min(node.low, child.low);
    if (child.low > node.discovery) addSorted(bridges, edge);
    if (!isRoot && child.low >= node.discovery) addSorted(articulations, u);
  };

  const visit = (u, parent) => {
    const node = nodes[u];
    node.parent = parent;
    node.discovery = clock;
    node.low = clock;
    clock += 1;
    discoveryOrder.push(u);

    let childCount = 0;
    for (const { neighbour: v, edge } of graph.neighbours(u)) {
      if (nodes[v].discovery === null) {
        childCount += 1;
        visit(v, u);
        finishChild(u, v, edge, parent === null);
      } else if (v !== parent) {
        // Discovery, not low: following the neighbour's own low would claim a route the neighbour alone provides.
        node.low = Math.min(node.low, nodes[v].discovery);
      }
    }

    if (parent === null && childCount >= 2) addSorted(articulations, u);
  };

  for (const root of graph.nodeIds) {
    if (nodes[root].discovery === null) {
      componentCount += 1;
      visit(root, null);
    }
  }

  return deepFreeze({
    discoveryOrder,
    table: graph.nodeIds.map((id) => ({ id, ...nodes[id] })),
    componentCount,
    bridges,
    articulations,
  });
}
