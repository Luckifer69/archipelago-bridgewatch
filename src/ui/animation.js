import { animationPlan, markerPosition } from './animationPlan.js';
import { svgElement } from './map.js';
import { ISLAND_RADIUS } from './mapModel.js';

const MARKER_RADIUS = 1.5;
const PULSE_GROWTH = 2.5;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function buildTravel(overlay, plan, graph) {
  const from = graph.node(plan.from);
  const to = graph.node(plan.to);
  const marker = svgElement('circle', { class: 'marker', r: MARKER_RADIUS, cx: from.x, cy: from.y });
  const line =
    plan.draw === 'none'
      ? null
      : svgElement('line', { class: `travel-line travel-${plan.draw}`, x1: from.x, y1: from.y, x2: from.x, y2: from.y });
  if (line) overlay.append(line);
  overlay.append(marker);

  return (t) => {
    const { x, y } = markerPosition(plan, from, to, t);
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    line?.setAttribute('x2', x);
    line?.setAttribute('y2', y);
  };
}

function buildEdgePulse(overlay, plan, graph) {
  const { a, b } = graph.edge(plan.edge);
  const [from, to] = [graph.node(a), graph.node(b)];
  const line = svgElement('line', { class: 'pulse-line', x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  overlay.append(line);
  return (t) => line.setAttribute('stroke-opacity', String(1 - t));
}

function buildIslandPulse(overlay, plan, graph) {
  const { x, y } = graph.node(plan.node);
  const ring = svgElement('circle', { class: 'pulse-ring', cx: x, cy: y, r: ISLAND_RADIUS });
  overlay.append(ring);
  return (t) => {
    ring.setAttribute('r', String(ISLAND_RADIUS + PULSE_GROWTH * t));
    ring.setAttribute('stroke-opacity', String(1 - t));
  };
}

const BUILDERS = {
  travel: buildTravel,
  'there-and-back': buildTravel,
  'pulse-edge': buildEdgePulse,
  'pulse-island': buildIslandPulse,
};

// Returns the animate function the Player expects. It only touches the overlay layer, which the next redraw replaces.
export function createAnimator(svg, getGraph) {
  return function animate(event, done) {
    const overlay = svg.querySelector('#overlay');
    if (prefersReducedMotion() || !overlay) {
      done();
      return () => {};
    }

    const plan = animationPlan(event);
    const update = BUILDERS[plan.kind](overlay, plan, getGraph());
    let frame = null;
    let startTime = null;

    const tick = (now) => {
      startTime ??= now;
      const t = Math.min((now - startTime) / plan.durationMs, 1);
      update(t);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        overlay.replaceChildren();
        done();
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      overlay.replaceChildren();
    };
  };
}
