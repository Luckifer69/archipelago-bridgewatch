import { ID_PATTERN } from './ids.js';

const MIN_NODES = 1;
const MAX_NODES = 12;
const MAX_EDGES = 20;
const MIN_COORDINATE = 0;
const MAX_COORDINATE = 100;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const show = (value) => (typeof value === 'string' ? `"${value}"` : String(value));

// Returns every problem found, each naming the node, edge or endpoint involved. An empty list means valid.
export function validateGraph(input) {
  if (!isObject(input) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    return [{ code: 'bad-shape', message: 'The graph must be an object with "nodes" and "edges" arrays.' }];
  }

  const errors = [];
  if (input.nodes.length < MIN_NODES || input.nodes.length > MAX_NODES) {
    errors.push({
      code: 'node-count',
      message: `The graph must have ${MIN_NODES} to ${MAX_NODES} nodes, but has ${input.nodes.length}.`,
    });
  }
  if (input.edges.length > MAX_EDGES) {
    errors.push({
      code: 'edge-count',
      message: `The graph can have at most ${MAX_EDGES} edges, but has ${input.edges.length}.`,
    });
  }

  const nodeIds = validateNodes(input.nodes, errors);
  validateEdges(input.edges, nodeIds, errors);
  return errors;
}

function validateNodes(nodes, errors) {
  const seen = new Set();
  nodes.forEach((node, index) => {
    if (!isObject(node)) {
      errors.push({ code: 'bad-node', message: `Node at position ${index} must be an object.` });
      return;
    }

    const nodeId = node.id;
    const label = `Node ${show(nodeId)}`;
    if (typeof nodeId !== 'string' || !ID_PATTERN.test(nodeId)) {
      errors.push({ code: 'bad-node-id', nodeId, message: `${label} at position ${index} has an invalid ID.` });
    } else if (seen.has(nodeId)) {
      errors.push({ code: 'duplicate-node-id', nodeId, message: `${label} is used more than once.` });
    }
    // Every string counts as existing, so one bad ID doesn't also report each edge that uses it.
    if (typeof nodeId === 'string') seen.add(nodeId);

    if (typeof node.name !== 'string' || node.name.trim() === '') {
      errors.push({ code: 'bad-node-name', nodeId, message: `${label} needs a non-empty display name.` });
    }

    for (const axis of ['x', 'y']) {
      const value = node[axis];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push({ code: 'bad-coordinate', nodeId, message: `${label} ${axis} must be a finite number, but is ${show(value)}.` });
      } else if (value < MIN_COORDINATE || value > MAX_COORDINATE) {
        errors.push({
          code: 'coordinate-out-of-range',
          nodeId,
          message: `${label} ${axis} must be from ${MIN_COORDINATE} through ${MAX_COORDINATE}, but is ${value}.`,
        });
      }
    }
  });
  return seen;
}

function validateEdges(edges, nodeIds, errors) {
  const seenIds = new Set();
  const seenPairs = new Map();
  edges.forEach((edge, index) => {
    if (!isObject(edge)) {
      errors.push({ code: 'bad-edge', message: `Edge at position ${index} must be an object.` });
      return;
    }

    const edgeId = edge.id;
    const label = `Edge ${show(edgeId)}`;
    if (typeof edgeId !== 'string' || !ID_PATTERN.test(edgeId)) {
      errors.push({ code: 'bad-edge-id', edgeId, message: `${label} at position ${index} has an invalid ID.` });
    } else if (seenIds.has(edgeId)) {
      errors.push({ code: 'duplicate-edge-id', edgeId, message: `${label} is used more than once.` });
    }
    seenIds.add(edgeId);

    for (const endpoint of [edge.a, edge.b]) {
      if (!nodeIds.has(endpoint)) {
        errors.push({ code: 'unknown-endpoint', edgeId, endpoint, message: `${label} connects to unknown node ${show(endpoint)}.` });
      }
    }

    if (edge.a === edge.b) {
      errors.push({ code: 'self-loop', edgeId, endpoint: edge.a, message: `${label} connects ${show(edge.a)} to itself.` });
    } else if (typeof edge.a === 'string' && typeof edge.b === 'string') {
      // '|' can't appear in a valid ID, and sorting makes A-B and B-A the same pair.
      const pair = [edge.a, edge.b].sort().join('|');
      if (seenPairs.has(pair)) {
        errors.push({
          code: 'duplicate-connection',
          edgeId,
          message: `${label} connects the same two nodes as edge ${show(seenPairs.get(pair))}.`,
        });
      } else {
        seenPairs.set(pair, edgeId);
      }
    }
  });
}
