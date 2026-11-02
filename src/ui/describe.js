// Turns events into plain language, so a volunteer can follow the proof without reading logs.

const NO_CHANGE = 'No values change.';

function lowChange(id, before, after, formula) {
  return before === after ? `low[${id}] stays ${after}, from ${formula}` : `low[${id}]: ${before} → ${after}, from ${formula}`;
}

function describeDiscover(event, graph) {
  const { name } = graph.node(event.node);
  if (event.parent === null) {
    return {
      heading: `Start at ${name}`,
      text: `${event.node} is the lowest unvisited ID, so it starts component ${event.component}.`,
      change: `discovery[${event.node}] = low[${event.node}] = ${event.discovery}. Parent: none (root).`,
    };
  }
  return {
    heading: `Reach ${name}`,
    text: `Crossing ${event.edge} from ${event.parent} reaches ${event.node} for the first time.`,
    change: `discovery[${event.node}] = low[${event.node}] = ${event.discovery}. Parent: ${event.parent}.`,
  };
}

function describeInspect(event) {
  const heading = `Inspect ${event.edge} from ${event.from}`;
  if (event.kind === 'tree') {
    return {
      heading,
      text: `${event.to} hasn't been visited, so ${event.edge} joins the DFS tree and the inspection crosses it.`,
      change: NO_CHANGE,
    };
  }
  if (event.kind === 'parent') {
    return {
      heading,
      text: `${event.edge} leads back to ${event.to}, the parent. It's how the inspection arrived, so it can't prove another route.`,
      change: NO_CHANGE,
    };
  }
  return {
    heading,
    text: `${event.to} was already visited, so ${event.edge} is an alternate connection.`,
    change: lowChange(
      event.from,
      event.lowBefore,
      event.lowAfter,
      `min(${event.lowBefore}, discovery[${event.to}] = ${event.neighbourDiscovery})`,
    ),
  };
}

function describeReturn(event) {
  return {
    heading: `Return to ${event.node}`,
    text: `${event.child} is finished, so the inspection returns over ${event.edge} and ${event.node} learns how far back ${event.child} can reach.`,
    change: lowChange(event.node, event.lowBefore, event.lowAfter, `min(${event.lowBefore}, low[${event.child}] = ${event.childLow})`),
  };
}

function describeBridgeCheck(event) {
  const comparison = `low[${event.child}] = ${event.childLow} > discovery[${event.node}] = ${event.parentDiscovery}`;
  if (event.isBridge) {
    return {
      heading: `${event.edge} is a critical bridge`,
      text: `Nothing from ${event.child} onward can reach ${event.node} or earlier without ${event.edge}, so closing it cuts that area off.`,
      change: `${comparison}: true`,
    };
  }
  return {
    heading: `${event.edge} is not a critical bridge`,
    text: `${event.child} has another route back to ${event.node} or earlier, so closing ${event.edge} leaves everyone connected.`,
    change: `${comparison}: false`,
  };
}

function describeArticulationCheck(event) {
  const comparison = `low[${event.child}] = ${event.childLow} >= discovery[${event.node}] = ${event.parentDiscovery}`;
  if (event.isArticulation) {
    return {
      heading: `${event.node} is an articulation island`,
      text: `${event.child}'s branch can't get past ${event.node} another way, so losing ${event.node} cuts that branch off.`,
      change: `${comparison}: true`,
    };
  }
  return {
    heading: `${event.child}'s branch doesn't depend on ${event.node}`,
    text: `${event.child}'s branch reaches further back than ${event.node}, so it stays connected without ${event.node}.`,
    change: `${comparison}: false`,
  };
}

function describeRootCheck(event) {
  const children = `${event.childCount} DFS ${event.childCount === 1 ? 'child' : 'children'}`;
  return {
    heading: `${event.node} is ${event.isArticulation ? 'an articulation island' : 'not an articulation island'}`,
    text: `${event.node} is a root with ${children}. A root splits the map only if it has at least 2, because they can only reach each other through it.`,
    change: `${event.childCount} >= 2: ${event.isArticulation}`,
  };
}

export function describeEvent(event, graph) {
  switch (event.type) {
    case 'discover':
      return describeDiscover(event, graph);
    case 'inspect':
      return describeInspect(event);
    case 'return':
      return describeReturn(event);
    case 'bridge-check':
      return describeBridgeCheck(event);
    case 'articulation-check':
      return describeArticulationCheck(event);
    case 'root-check':
      return describeRootCheck(event);
    case 'node-complete':
      return {
        heading: `${event.node} is finished`,
        text: `Every neighbour of ${event.node} has been inspected.`,
        change: `Final values: discovery[${event.node}] = ${event.discovery}, low[${event.node}] = ${event.low}.`,
      };
    case 'component-complete':
      return {
        heading: `Component ${event.component} is complete`,
        text: `The search from ${event.node} has reached everything it can.`,
        change: `Islands in this component: ${event.size}.`,
      };
    default:
      throw new Error(`Unknown event type: ${event.type}`);
  }
}

// One row for each critical item found so far, with the numbers that prove it.
export function summaryProofs({ snapshot, history }) {
  const bridges = snapshot.bridges.map((id) => {
    const proof = history.find((event) => event.type === 'bridge-check' && event.edge === id && event.isBridge);
    return { id, proof: `low[${proof.child}] = ${proof.childLow} > discovery[${proof.node}] = ${proof.parentDiscovery}` };
  });
  const articulations = snapshot.articulations.map((id) => {
    const proof = history.find(
      (event) =>
        event.node === id &&
        ((event.type === 'articulation-check' && event.isArticulation) || (event.type === 'root-check' && event.isArticulation)),
    );
    const text =
      proof.type === 'root-check'
        ? `root with ${proof.childCount} DFS children`
        : `low[${proof.child}] = ${proof.childLow} >= discovery[${proof.node}] = ${proof.parentDiscovery}`;
    return { id, proof: text };
  });
  return { bridges, articulations };
}
