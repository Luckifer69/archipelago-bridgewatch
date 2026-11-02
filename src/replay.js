import { loadGraph } from './engine/graphState.js';
import { initialSnapshot, runLowLink } from './engine/lowlink.js';

const EMPTY = Object.freeze({ graph: null, events: Object.freeze([]), result: null, start: null, errors: Object.freeze([]) });

// Holds one analysed graph and a position in its events. Step, Run to End and Reset only ever move the position.
export class Replay {
  #source;
  #analysis = EMPTY;
  #position = -1;

  // The source graph is what Reset returns to, whatever has been loaded since.
  constructor(source) {
    this.#source = source;
  }

  load(input = this.#source) {
    const loaded = loadGraph(input);
    this.#position = -1;
    if (!loaded.ok) {
      // Clear everything first, so a failed load can't leave an earlier graph's replay on screen.
      this.#analysis = { ...EMPTY, errors: Object.freeze(loaded.errors) };
      return false;
    }
    const { events, result } = runLowLink(loaded.graph);
    this.#analysis = { graph: loaded.graph, events, result, start: initialSnapshot(loaded.graph), errors: EMPTY.errors };
    return true;
  }

  step() {
    if (this.atEnd) return null;
    this.#position += 1;
    return this.#analysis.events[this.#position];
  }

  runToEnd() {
    this.#position = this.#analysis.events.length - 1;
  }

  reset() {
    this.load(this.#source);
  }

  get atEnd() {
    return this.#position === this.#analysis.events.length - 1;
  }

  // Everything the interface draws. Position -1 means before the first event.
  view() {
    const { graph, events, result, start, errors } = this.#analysis;
    const event = events[this.#position] ?? null;
    return {
      graph,
      errors,
      result,
      position: this.#position,
      total: events.length,
      event,
      snapshot: event ? event.snapshot : start,
      history: events.slice(0, this.#position + 1),
      atEnd: this.atEnd,
    };
  }
}
