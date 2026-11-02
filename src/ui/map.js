import { CURRENT_RING_GAP, DIAMOND_RADIUS, FONT, ISLAND_RADIUS, LINE_GAP, mapModel } from './mapModel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgElement(tag, attributes = {}, ...children) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

const title = (text) => svgElement('title', {}, text);

function drawEdge(edge) {
  const line = (className) => svgElement('line', { class: className, x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2 });
  const group = svgElement('g', { 'data-edge': edge.id, 'data-status': edge.status }, title(edge.description));
  if (edge.isCurrent) group.append(line('edge-highlight'));
  group.append(line(`edge edge-${edge.status}`));
  // A thin line of water down the middle of a thick line reads as a double line.
  if (edge.status === 'bridge') group.append(line('edge-bridge-gap'));
  group.append(svgElement('text', { class: `edge-label edge-label-${edge.status}`, x: edge.labelX, y: edge.labelY }, edge.label));
  return group;
}

function drawIslandShape(node) {
  const className = `island island-${node.status}`;
  if (node.shape === 'diamond') {
    const r = DIAMOND_RADIUS;
    const points = `${node.x},${node.y - r} ${node.x + r},${node.y} ${node.x},${node.y + r} ${node.x - r},${node.y}`;
    return svgElement('polygon', { class: className, points });
  }
  return svgElement('circle', { class: className, cx: node.x, cy: node.y, r: ISLAND_RADIUS });
}

function drawLabel(node) {
  const { anchor, left, right, top } = node.label;
  const x = { start: left, middle: (left + right) / 2, end: right }[anchor];
  const line = (className, y, text) => svgElement('text', { class: className, x, y, 'text-anchor': anchor }, text);

  const firstLine = top + FONT.id;
  const secondLine = firstLine + FONT.name + LINE_GAP;
  const thirdLine = secondLine + FONT.values + LINE_GAP;
  return svgElement(
    'g',
    {},
    line('island-id', firstLine, node.title),
    line('island-name', secondLine, node.name),
    line('island-values', thirdLine, node.values),
  );
}

function drawIsland(node) {
  const group = svgElement('g', { 'data-island': node.id, 'data-status': node.status }, title(node.description));
  if (node.isCurrent) {
    const r = (node.shape === 'diamond' ? DIAMOND_RADIUS : ISLAND_RADIUS) + CURRENT_RING_GAP;
    group.append(svgElement('circle', { class: 'island-ring', cx: node.x, cy: node.y, r }));
  }
  group.append(drawIslandShape(node), drawLabel(node));
  return group;
}

export function renderMap(svg, view) {
  const model = mapModel(view);
  if (!model) {
    svg.removeAttribute('viewBox');
    svg.replaceChildren(
      svgElement('text', { class: 'map-placeholder', x: '50%', y: '50%' }, 'Press Load My Archipelago to see the map'),
    );
    return;
  }

  const { x, y, width, height } = model.viewBox;
  svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  svg.replaceChildren(
    svgElement('g', { id: 'edges' }, ...model.edges.map(drawEdge)),
    svgElement('g', { id: 'islands' }, ...model.nodes.map(drawIsland)),
    svgElement('g', { id: 'overlay' }),
  );
}
