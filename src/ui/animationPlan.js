// Decides how each event animates. It only reads events, so animation can never change the replay.

export const TRAVEL_MS = 600;
export const PULSE_MS = 250;

export function animationPlan(event) {
  if (event.type === 'inspect' && event.kind === 'tree') {
    return { kind: 'travel', from: event.from, to: event.to, draw: 'solid', durationMs: TRAVEL_MS };
  }
  if (event.type === 'inspect' && event.kind === 'visited') {
    return { kind: 'there-and-back', from: event.from, to: event.to, draw: 'dashed', durationMs: TRAVEL_MS };
  }
  if (event.type === 'return') {
    return { kind: 'travel', from: event.from, to: event.to, draw: 'none', durationMs: TRAVEL_MS };
  }
  if (event.type === 'inspect' || event.type === 'bridge-check') {
    return { kind: 'pulse-edge', edge: event.edge, durationMs: PULSE_MS };
  }
  return { kind: 'pulse-island', node: event.node, durationMs: PULSE_MS };
}

const smooth = (t) => t * t * (3 - 2 * t);

// Where the marker is at progress t (0 to 1), and how far along the bridge the drawn line has reached.
export function markerPosition(plan, from, to, t) {
  const travelled = plan.kind === 'there-and-back' ? 1 - Math.abs(1 - 2 * t) : t;
  const eased = smooth(travelled);
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
}
