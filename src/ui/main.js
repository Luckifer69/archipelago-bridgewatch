import { ARCHIPELAGO } from '../archipelago/index.js';
import { Player } from '../player.js';
import { Replay } from '../replay.js';
import { createAnimator } from './animation.js';
import { renderMap } from './map.js';
import { renderPanels } from './panels.js';

const byId = (id) => document.querySelector(`#${id}`);

const map = byId('map');
const buttons = { load: byId('load'), step: byId('step'), run: byId('run'), reset: byId('reset') };
const progress = byId('progress');
const panels = {
  currentEvent: byId('current-event'),
  table: byId('node-table'),
  summary: byId('summary'),
  history: byId('history'),
};

const replay = new Replay(ARCHIPELAGO);

// The replay moves on when an animation starts, but the screen only catches up when it finishes.
let shownPosition = -1;

function updateControls() {
  const { graph, total, atEnd } = replay.view();
  const playing = player.isPlaying;
  buttons.step.disabled = !graph || playing || atEnd;
  buttons.run.disabled = !graph || (atEnd && !playing);
  buttons.reset.disabled = !graph;
  buttons.run.textContent = playing ? 'Skip to End' : 'Run to End';
  progress.textContent = graph ? `Event ${shownPosition + 1} of ${total}` : 'No map loaded';
}

function render() {
  const view = replay.view();
  shownPosition = view.position;
  renderMap(map, view);
  renderPanels(panels, view);
  updateControls();
}

const player = new Player(replay, {
  animate: createAnimator(map, () => replay.view().graph),
  render,
});

buttons.load.addEventListener('click', () => player.load());
buttons.step.addEventListener('click', () => {
  player.step();
  updateControls();
});
buttons.run.addEventListener('click', () => {
  player.runToEnd();
  updateControls();
});
buttons.reset.addEventListener('click', () => player.reset());

render();
