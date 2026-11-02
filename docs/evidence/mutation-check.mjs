// Proves the tests can fail: breaks the code one way at a time, in a temporary copy, and expects the tests to notice.
// Run with: node docs/evidence/mutation-check.mjs
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const MUTATIONS = [
  ['bridge rule uses >= instead of >', 'src/engine/lowlink.js', 'const isBridge = childLow > parentDiscovery;', 'const isBridge = childLow >= parentDiscovery;'],
  ['articulation rule uses > instead of >=', 'src/engine/lowlink.js', 'const isArticulation = childLow >= parentDiscovery;', 'const isArticulation = childLow > parentDiscovery;'],
  ['back connection uses low instead of discovery', 'src/engine/lowlink.js', 'const neighbourDiscovery = state.nodes[v].discovery;', 'const neighbourDiscovery = state.nodes[v].low;'],
  ['return ignores the child low value', 'src/engine/lowlink.js', 'node.low = Math.min(lowBefore, childLow);', 'node.low = lowBefore;'],
  ['root needs only 1 child', 'src/engine/lowlink.js', 'const isArticulation = childCount >= 2;', 'const isArticulation = childCount >= 1;'],
  ['root also gets the non-root rule', 'src/engine/lowlink.js', 'if (!isRoot) {', 'if (true) {'],
  ['parent treated as a back connection', 'src/engine/lowlink.js', '} else if (v === parent) {', '} else if (false) {'],
  ['clock restarts for each component', 'src/engine/lowlink.js', 'const clockAtStart = clock;', 'clock = 0; const clockAtStart = clock;'],
  ['snapshots share one state object', 'src/engine/lowlink.js', 'snapshot: structuredClone(state)', 'snapshot: state'],
  ['neighbours left unsorted', 'src/engine/graphState.js', 'entries.sort((first, second) => compareIds(first.neighbour, second.neighbour));', ''],
  ['locale sort instead of ASCII', 'src/engine/ids.js', 'if (a < b) return -1;\n  return a > b ? 1 : 0;', 'return a.localeCompare(b);'],
  ['coordinate upper bound missing', 'src/engine/validate.js', 'value < MIN_COORDINATE || value > MAX_COORDINATE', 'value < MIN_COORDINATE'],
  ['reversed duplicate pair missed', 'src/engine/validate.js', "[edge.a, edge.b].sort().join('|')", "[edge.a, edge.b].join('|')"],
  ['failed load keeps the old graph', 'src/replay.js', 'this.#analysis = { ...EMPTY, errors: Object.freeze(loaded.errors) };', 'this.#analysis = { ...this.#analysis, errors: Object.freeze(loaded.errors) };'],
  ['Reset keeps the position', 'src/replay.js', 'reset() {\n    this.load(this.#source);', 'reset() {'],
  ['Step mid-animation loses the press', 'src/player.js', 'if (this.#cancelAnimation) {\n      this.#stopAnimation();\n      this.#render();\n    }', 'if (this.#cancelAnimation) return;'],
  ['Reset leaves the animation running', 'src/player.js', 'this.#stopAnimation();\n    this.#playing = false;\n    this.#replay.reset();', 'this.#playing = false;\n    this.#replay.reset();'],
  ['layout ignores sorting', 'scripts/layout.js', '[...nodes].sort(byId)', '[...nodes]'],
  ['app reads the documented answers', 'src/replay.js', "import { loadGraph } from './engine/graphState.js';", "import { loadGraph } from './engine/graphState.js';\nimport '../fixtures/graphs.js';"],
];

const copy = mkdtempSync(join(tmpdir(), 'mutation-check-'));
for (const item of ['package.json', 'server.js', 'index.html', 'styles.css', 'src', 'scripts', 'test', 'fixtures']) {
  cpSync(join(ROOT, item), join(copy, item), { recursive: true });
}
symlinkSync(join(ROOT, 'node_modules'), join(copy, 'node_modules'));

let caught = 0;
for (const [name, file, from, to] of MUTATIONS) {
  const path = join(copy, file);
  const original = readFileSync(path, 'utf8');
  if (!original.includes(from)) throw new Error(`Mutation "${name}" no longer matches ${file}`);
  writeFileSync(path, original.replace(from, to));

  const run = spawnSync(process.execPath, ['--test'], { cwd: copy, encoding: 'utf8' });
  const failing = Number(/^ℹ fail (\d+)/m.exec(run.stdout)?.[1] ?? 0);
  const noticed = run.status !== 0;
  if (noticed) caught += 1;
  console.log(`${noticed ? 'caught' : 'MISSED'}  ${String(failing).padStart(3)} failing  ${name}`);
  writeFileSync(path, original);
}

rmSync(copy, { recursive: true, force: true });
console.log(`\n${caught} of ${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
