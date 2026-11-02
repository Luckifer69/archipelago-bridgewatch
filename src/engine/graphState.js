import { deepFreeze } from './freeze.js';
import { compareIds } from './ids.js';
import { validateGraph } from './validate.js';

// The single source for graph information. It never changes once built; traversal values live in event snapshots.
export class GraphState {
  #nodesById;
  #edgesById;
  #adjacency;

  // Expects valid input, so use loadGraph unless the input has already been validated.
  constructor(input) {
    const byId = (a, b) => compareIds(a.id, b.id);
    this.nodes = deepFreeze(input.nodes.map((node) => ({ ...node })).sort(byId));
    this.edges = deepFreeze(input.edges.map((edge) => ({ ...edge })).sort(byId));
    this.nodeIds = deepFreeze(this.nodes.map((node) => node.id));
    this.edgeIds = deepFreeze(this.edges.map((edge) => edge.id));

    this.#nodesById = new Map(this.nodes.map((node) => [node.id, node]));
    this.#edgesById = new Map(this.edges.map((edge) => [edge.id, edge]));

    this.#adjacency = new Map(this.nodeIds.map((id) => [id, []]));
    for (const edge of this.edges) {
      this.#adjacency.get(edge.a).push({ neighbour: edge.b, edge: edge.id });
      this.#adjacency.get(edge.b).push({ neighbour: edge.a, edge: edge.id });
    }
    for (const entries of this.#adjacency.values()) {
      entries.sort((first, second) => compareIds(first.neighbour, second.neighbour));
      deepFreeze(entries);
    }

    Object.freeze(this);
  }

  node(id) {
    return this.#nodesById.get(id);
  }

  edge(id) {
    return this.#edgesById.get(id);
  }

  // Sorted by neighbour ID, each paired with the connecting edge ID.
  neighbours(id) {
    return this.#adjacency.get(id);
  }
}

export function loadGraph(input) {
  const errors = validateGraph(input);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, graph: new GraphState(input) };
}
