import { describeEvent, summaryProofs } from './describe.js';

function element(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const showValue = (value) => (value === null ? '—' : String(value));

function renderCurrentEvent(container, { graph, errors, event }) {
  if (errors.length > 0) {
    const list = element('ul', 'errors', ...errors.map((error) => element('li', '', error.message)));
    container.replaceChildren(element('p', 'event-heading', 'This graph is not valid, so nothing was analysed.'), list);
    return;
  }
  if (!graph) {
    container.replaceChildren(element('p', 'event-text', 'Load the archipelago to begin.'));
    return;
  }
  if (!event) {
    container.replaceChildren(element('p', 'event-text', 'Ready. Press Step to watch the inspection one event at a time.'));
    return;
  }
  const { heading, text, change } = describeEvent(event, graph);
  container.replaceChildren(
    element('p', 'event-heading', heading),
    element('p', 'event-text', text),
    element('p', 'event-change', change),
  );
}

function renderTable(table, { graph, snapshot, event }) {
  if (!graph) {
    table.replaceChildren();
    return;
  }
  const headings = ['ID', 'Hosts', 'Parent', 'Discovery', 'Low'].map((text) => {
    const heading = element('th', '', text);
    heading.scope = 'col';
    return heading;
  });

  const articulations = new Set(snapshot.articulations);
  const rows = graph.nodes.map((node) => {
    const { parent, discovery, low } = snapshot.nodes[node.id];
    const isCurrent = event?.node === node.id;
    const markers = `${isCurrent ? '▶ ' : ''}${articulations.has(node.id) ? '◆ ' : ''}`;
    const parentText = discovery !== null && parent === null ? 'root' : showValue(parent);
    const row = element(
      'tr',
      isCurrent ? 'current-row' : '',
      element('td', 'id-cell', `${markers}${node.id}`),
      element('td', 'hosts-cell', node.role ?? '—'),
      element('td', '', parentText),
      element('td', 'number', showValue(discovery)),
      element('td', 'number', showValue(low)),
    );
    row.dataset.island = node.id;
    return row;
  });
  table.replaceChildren(element('thead', '', element('tr', '', ...headings)), element('tbody', '', ...rows));
}

function proofList(items, marker, emptyText) {
  if (items.length === 0) return element('p', 'summary-empty', emptyText);
  return element(
    'ul',
    'proofs',
    ...items.map(({ id, proof }) => element('li', '', element('strong', '', `${marker} ${id}`), element('span', 'proof', proof))),
  );
}

function renderSummary(container, view) {
  const { graph, snapshot, atEnd, total, position } = view;
  if (!graph) {
    container.replaceChildren(element('p', 'summary-empty', 'No results yet.'));
    return;
  }
  const finished = atEnd && total > 0 && position >= 0;
  const { bridges, articulations } = summaryProofs(view);
  const waiting = finished ? 'None.' : 'None found yet.';

  container.replaceChildren(
    element(
      'p',
      'summary-status',
      element('strong', '', `Components: ${snapshot.componentCount}`),
      finished ? ' · Inspection complete' : ' · Results appear as the replay proves them',
    ),
    element(
      'div',
      'summary-columns',
      element('div', '', element('h3', '', `Critical bridges (${bridges.length})`), proofList(bridges, '⚠', waiting)),
      element('div', '', element('h3', '', `Articulation islands (${articulations.length})`), proofList(articulations, '◆', waiting)),
    ),
  );
}

function renderHistory(list, { graph, history }) {
  const items = history.map((event) => {
    const { heading, change } = describeEvent(event, graph);
    const item = element(
      'li',
      event === history.at(-1) ? 'current-item' : '',
      element('span', 'history-heading', heading),
      element('span', 'history-change', change),
    );
    item.value = event.seq + 1;
    return item;
  });
  list.replaceChildren(...items);
  list.scrollTop = list.scrollHeight;
}

export function renderPanels(elements, view) {
  renderCurrentEvent(elements.currentEvent, view);
  renderTable(elements.table, view);
  renderSummary(elements.summary, view);
  renderHistory(elements.history, view);
}
