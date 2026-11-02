// Decides what every island and bridge looks like for one view. It has no browser code, so all of it can be tested directly.

export const ISLAND_RADIUS = 3.2;
export const DIAMOND_RADIUS = ISLAND_RADIUS * 1.3;
export const CURRENT_RING_GAP = 1.4;
export const FONT = { id: 2.4, name: 1.9, values: 1.9 };

export const LINE_GAP = 0.45;
// Clears the largest thing drawn at an island: a diamond with its current ring.
const LABEL_GAP = DIAMOND_RADIUS + CURRENT_RING_GAP + LINE_GAP;
const VIEW_PADDING = 1.5;
const LABEL_HEIGHT = FONT.id + FONT.name + FONT.values + 2 * LINE_GAP;
const ESTIMATED_MARKERS = '▶ ◆ ';
const BOLD_CHAR_WIDTH = 0.66;
const CHAR_WIDTH = 0.56;

const BRIDGE_LABEL_WIDTH = 7;
const BRIDGE_LABEL_HEIGHT = 2.6;
const SEGMENT_SAMPLES = 60;

const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function boxesOverlap(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function segmentTouchesBox(from, to, box) {
  for (let i = 0; i <= SEGMENT_SAMPLES; i++) {
    const t = i / SEGMENT_SAMPLES;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true;
  }
  return false;
}

function islandBox({ x, y }) {
  const r = DIAMOND_RADIUS + CURRENT_RING_GAP;
  return { left: x - r, right: x + r, top: y - r, bottom: y + r };
}

function bridgeLabelBox(point) {
  return {
    left: point.x - BRIDGE_LABEL_WIDTH / 2,
    right: point.x + BRIDGE_LABEL_WIDTH / 2,
    top: point.y - BRIDGE_LABEL_HEIGHT / 2,
    bottom: point.y + BRIDGE_LABEL_HEIGHT / 2,
  };
}

// Candidate spots around an island, in order of preference.
function labelCandidates({ x, y }, width) {
  const near = LABEL_GAP;
  const diagonal = near * 0.8;
  const h = LABEL_HEIGHT;
  // Beside the island first: the map panel is wider than tall, so a shorter map can be drawn larger.
  return [
    { anchor: 'start', left: x + near, top: y - h / 2 },
    { anchor: 'end', left: x - near - width, top: y - h / 2 },
    { anchor: 'middle', left: x - width / 2, top: y + near },
    { anchor: 'middle', left: x - width / 2, top: y - near - h },
    { anchor: 'start', left: x + diagonal, top: y + diagonal },
    { anchor: 'end', left: x - diagonal - width, top: y + diagonal },
    { anchor: 'start', left: x + diagonal, top: y - diagonal - h },
    { anchor: 'end', left: x - diagonal - width, top: y - diagonal - h },
  ].map((spot) => ({ ...spot, right: spot.left + width, bottom: spot.top + h }));
}

// Greedy but repeatable: it only depends on the graph, so labels never move during a replay.
export function placeLabels(graph) {
  const bridgeBoxes = graph.edges.map((edge) => bridgeLabelBox(midpoint(graph.node(edge.a), graph.node(edge.b))));
  const placed = new Map();

  for (const node of graph.nodes) {
    const width = Math.max(
      (ESTIMATED_MARKERS.length + node.id.length) * FONT.id * BOLD_CHAR_WIDTH,
      node.name.length * FONT.name * CHAR_WIDTH,
    );

    let best = null;
    let bestScore = Infinity;
    for (const spot of labelCandidates(node, width)) {
      let score = 0;
      for (const edge of graph.edges) {
        if (segmentTouchesBox(graph.node(edge.a), graph.node(edge.b), spot)) score += 10;
      }
      for (const other of graph.nodes) {
        if (other.id !== node.id && boxesOverlap(spot, islandBox(other))) score += 10;
      }
      for (const box of bridgeBoxes) {
        if (boxesOverlap(spot, box)) score += 10;
      }
      for (const box of placed.values()) {
        if (boxesOverlap(spot, box)) score += 10;
      }
      if (score < bestScore) {
        best = spot;
        bestScore = score;
      }
    }
    placed.set(node.id, best);
  }
  return placed;
}

function viewBoxFor(graph, labels) {
  const boxes = [...graph.nodes.map(islandBox), ...labels.values()];
  const left = Math.min(...boxes.map((box) => box.left)) - VIEW_PADDING;
  const right = Math.max(...boxes.map((box) => box.right)) + VIEW_PADDING;
  const top = Math.min(...boxes.map((box) => box.top)) - VIEW_PADDING;
  const bottom = Math.max(...boxes.map((box) => box.bottom)) + VIEW_PADDING;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const EDGE_WORDS = {
  unvisited: 'not inspected yet',
  tree: 'DFS-tree bridge',
  'non-tree': 'inspected non-tree connection',
  bridge: 'critical bridge',
};

const EDGE_MARKERS = { 'non-tree': '↺ ', bridge: '⚠ ' };

function edgeModel(edge, graph, snapshot, event) {
  const a = graph.node(edge.a);
  const b = graph.node(edge.b);
  const status = snapshot.edges[edge.id];
  const isCurrent = event?.edge === edge.id;
  const marker = `${isCurrent ? '▶ ' : ''}${EDGE_MARKERS[status] ?? ''}`;
  const middle = midpoint(a, b);
  return {
    id: edge.id,
    x1: a.x,
    y1: a.y,
    x2: b.x,
    y2: b.y,
    status,
    isCurrent,
    label: `${marker}${edge.id}`,
    labelX: middle.x,
    labelY: middle.y,
    description: `${edge.id} between ${edge.a} and ${edge.b}: ${EDGE_WORDS[status]}${isCurrent ? ', current' : ''}`,
  };
}

function nodeModel(node, snapshot, event, articulations, label) {
  const { discovery, low } = snapshot.nodes[node.id];
  const isVisited = discovery !== null;
  const isArticulation = articulations.has(node.id);
  const isCurrent = event?.node === node.id;
  const markers = `${isCurrent ? '▶ ' : ''}${isArticulation ? '◆ ' : ''}`;
  const state = isVisited ? 'visited' : 'unvisited';
  const hosts = node.role ? `, hosts ${node.role}` : '';
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    status: state,
    isArticulation,
    isCurrent,
    shape: isArticulation ? 'diamond' : 'circle',
    title: `${markers}${node.id}`,
    name: node.name,
    values: isVisited ? `d${discovery} · l${low}` : '',
    label,
    description: `${node.name} (${node.id})${hosts}: ${state}${isArticulation ? ', articulation island' : ''}${isCurrent ? ', current' : ''}`,
  };
}

export function mapModel({ graph, snapshot, event }) {
  if (!graph) return null;
  const labels = placeLabels(graph);
  const articulations = new Set(snapshot.articulations);
  return {
    viewBox: viewBoxFor(graph, labels),
    edges: graph.edges.map((edge) => edgeModel(edge, graph, snapshot, event)),
    nodes: graph.nodes.map((node) => nodeModel(node, snapshot, event, articulations, labels.get(node.id))),
  };
}
