import { ARCHIPELAGO } from '../archipelago/index.js';
import { Player } from '../player.js';
import { Replay } from '../replay.js';
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

function updateControls() {
  const { graph, position, total, atEnd } = replay.view();
  const playing = player.isPlaying;
  buttons.step.disabled = !graph || playing || atEnd;
  buttons.run.disabled = !graph || (atEnd && !playing);
  buttons.reset.disabled = !graph;
  if (!graph) {
    progress.textContent = 'No map loaded';
  } else if (playing) {
    progress.textContent = `Event ${position + 1} of ${total} · playing, press Run to End again to skip`;
  } else {
    progress.textContent = `Event ${position + 1} of ${total}`;
  }
}

function render() {
  const view = replay.view();
  renderMap(map, view);
  renderPanels(panels, view);
  updateControls();
}

// The animation arrives in the next commit. Until then every event finishes immediately.
const player = new Player(replay, {
  animate: (event, done) => {
    done();
    return () => {};
  },
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
