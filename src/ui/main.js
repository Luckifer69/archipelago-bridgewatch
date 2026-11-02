import { ARCHIPELAGO } from '../archipelago/index.js';
import { Replay } from '../replay.js';
import { renderMap } from './map.js';

const replay = new Replay(ARCHIPELAGO);
const map = document.querySelector('#map');

function render() {
  renderMap(map, replay.view());
}

document.querySelector('#load').addEventListener('click', () => {
  replay.load();
  render();
});

render();
