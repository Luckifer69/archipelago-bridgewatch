// Drives the real app in Chrome and compares every animated state with an unanimated control run.
// Run with: npm install --no-save playwright-core && node docs/evidence/browser-walkthrough.mjs
// It uses the installed Chrome. Set CHROME_PATH if Playwright can't find it.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createAppServer } from '../../server.js';

const out = fileURLToPath(new URL('./screenshots', import.meta.url));
const server = createAppServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const URL_UNDER_TEST = `http://127.0.0.1:${server.address().port}/`;
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const results = []; const check = (name, ok, extra='') => { results.push(ok); console.log(`${ok?'PASS':'FAIL'}  ${name}${extra?'  -> '+extra:''}`); };

const state = (p) => p.evaluate(() => ({
  progress: document.querySelector('#progress').textContent.split(' · ')[0],
  event: document.querySelector('#current-event').textContent,
  table: [...document.querySelectorAll('#node-table tbody tr')].map(r => [...r.children].map(c => c.textContent).join('|')),
  summary: document.querySelector('#summary').textContent,
  history: [...document.querySelectorAll('#history li')].map(l => l.value + ':' + l.textContent),
  edges: [...document.querySelectorAll('#map [data-edge]')].map(e => e.dataset.edge + ':' + e.dataset.status + ':' + e.querySelector('.edge-label').textContent),
  islands: [...document.querySelectorAll('#map [data-island]')].map(i => i.dataset.island + ':' + i.dataset.status + ':' + (i.querySelector('polygon') ? 'diamond' : 'circle') + ':' + !!i.querySelector('.island-ring') + ':' + i.querySelector('.island-values').textContent),
  overlay: document.querySelector('#overlay')?.childElementCount ?? 0,
}));

// Control: the same states with animation switched off through reduced motion.
const ctlCtx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const ctl = await ctlCtx.newPage();
const ctlErrors = []; ctl.on('console', m => { if (m.type()==='error') ctlErrors.push(m.text()); }); ctl.on('pageerror', e => ctlErrors.push(String(e)));
await ctl.goto(URL_UNDER_TEST); await ctl.click('#load');
const control = [await state(ctl)];
for (let i = 0; i < 56; i++) { await ctl.click('#step'); control.push(await state(ctl)); }
check('reduced motion: each Step updates immediately, 56 events', control[56].progress === 'Event 56 of 56');
check('reduced motion: no animation overlay is ever left behind', control.every(s => s.overlay === 0));
await ctl.click('#reset'); check('reduced motion: Reset is exact', JSON.stringify(await state(ctl)) === JSON.stringify(control[0]));
await ctl.click('#run'); check('reduced motion: Run to End jumps straight to the final state', JSON.stringify(await state(ctl)) === JSON.stringify(control[56]));
check('reduced motion: no console errors', ctlErrors.length === 0, ctlErrors.join(';'));

const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errors = []; p.on('console', m => { if (m.type()==='error') errors.push(m.text()); }); p.on('pageerror', e => errors.push(String(e)));
await p.goto(URL_UNDER_TEST);
const dis = async () => p.evaluate(() => ['load','step','run','reset'].map(i => document.getElementById(i).disabled));
check('before load: only Load is enabled', JSON.stringify(await dis()) === '[false,true,true,true]');
await p.screenshot({ path: `${out}/1-before-load.png` });
await p.click('#load');
const start = await state(p);
check('Load gives Event 0 of 56', start.progress === 'Event 0 of 56');
check('Load matches the control pre-traversal state', JSON.stringify(start) === JSON.stringify(control[0]));
await p.screenshot({ path: `${out}/2-loaded.png` });
const fit = await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight, document.documentElement.scrollWidth, innerWidth]);
check('everything fits at 1280x800 with no page scrolling', fit[0]===fit[1] && fit[2]===fit[3], fit.join(','));

const settle = async () => p.waitForFunction(() => (document.querySelector('#overlay')?.childElementCount ?? 0) === 0);
const stepTo = async (n) => { for (;;) { const s = await state(p); const cur = Number(s.progress.split(' ')[1]); if (cur >= n) break; await p.click('#step'); await settle(); } };

await stepTo(16);
check('events 1-16 stepped with animation match the control', JSON.stringify(await state(p)) === JSON.stringify(control[16]));
await p.click('#step');           // event 17: FLAG looks back at DOUBLOON over B07
await p.waitForTimeout(200);
const mid = await state(p);
const has = await p.evaluate(() => ({ marker: !!document.querySelector('#overlay .marker'), dashed: !!document.querySelector('#overlay .travel-dashed') }));
check('mid-animation: marker and dashed line are on the map', has.marker && has.dashed, JSON.stringify(has));
const flagMid = mid.table.find(r => r.includes('FLAG|'));
check('mid-animation: FLAG low still shows 5', flagMid.endsWith('|5|5'), flagMid);
check('mid-animation: the counter has not moved on yet', mid.progress === 'Event 16 of 56', mid.progress);
await p.screenshot({ path: `${out}/3-mid-animation.png` });
await settle();
const after = await state(p);
const flagAfter = after.table.find(r => r.includes('FLAG|'));
check('after animation: FLAG low shows 3', flagAfter.endsWith('|5|3'), flagAfter);
check('after animation: state matches the control', JSON.stringify(after) === JSON.stringify(control[17]));
await p.screenshot({ path: `${out}/4-after-low-update.png` });

for (let i = 0; i < 10; i++) await p.click('#step');
await settle();
const rapid = await state(p);
check('10 rapid Step presses advance exactly 10 events', rapid.progress === 'Event 27 of 56', rapid.progress);
check('rapid presses end in the same state as the control', JSON.stringify(rapid) === JSON.stringify(control[27]));
await p.screenshot({ path: `${out}/5-first-critical-bridge.png` });

await stepTo(40);
check('event 40 matches the control (DOUBLOON: 3 >= 3)', JSON.stringify(await state(p)) === JSON.stringify(control[40]));
await p.screenshot({ path: `${out}/6-articulation-equal.png` });
await stepTo(44);
const b04 = await state(p);
check('event 44 matches the control (B04: 3 > 2)', JSON.stringify(b04) === JSON.stringify(control[44]));
check('event 44 explains B04 with its numbers', b04.event.includes('low[DOUBLOON] = 3 > discovery[COMPASS] = 2: true'), b04.event);
await p.screenshot({ path: `${out}/7-bridge-B04.png` });

await p.click('#step'); await p.waitForTimeout(80); await p.click('#reset');
await p.waitForTimeout(700);
check('Reset mid-animation: back to the pre-traversal state, and nothing redraws afterwards', JSON.stringify(await state(p)) === JSON.stringify(control[0]));

await p.click('#run');
const playing = await dis();
check('Run to End: Step is disabled while playing', playing[1] === true);
const hint = await p.textContent('#progress');
check('Run to End: the status explains how to skip', hint.includes('press Run to End again to skip'), hint);
await p.waitForTimeout(1600);
const during = await state(p);
const n = Number(during.progress.split(' ')[1]);
check('Run to End: plays gradually, not instantly', n > 0 && n < 56, `at event ${n} after 1.6s`);
await p.click('#run');
await p.waitForTimeout(700);
check('Skip: pressing Run to End again jumps to the final state', JSON.stringify(await state(p)) === JSON.stringify(control[56]));
const skipped = await dis();
check('Skip: Step and Run are disabled at the end', skipped[1] && skipped[2]);

await p.click('#reset');
check('second Reset is exact', JSON.stringify(await state(p)) === JSON.stringify(control[0]));
const t0 = Date.now();
await p.click('#run');
await p.waitForFunction(() => document.querySelector('#progress').textContent === 'Event 56 of 56', null, { timeout: 60000 });
const secs = (Date.now() - t0) / 1000;
check('a full animated run takes about 20 seconds', secs > 18 && secs < 26, `${secs.toFixed(1)}s`);
const full = await state(p);
check('the animated run ends in the same state and history as stepping', JSON.stringify(full) === JSON.stringify(control[56]));
await p.screenshot({ path: `${out}/8-final.png` });

await p.click('#reset');
for (let i = 0; i < 56; i++) { await p.click('#step'); await settle(); }
check('stepping all 56 events with animation matches the complete run', JSON.stringify(await state(p)) === JSON.stringify(full));
await p.click('#load');
check('Load after a finished run restores the same pre-traversal state', JSON.stringify(await state(p)) === JSON.stringify(control[0]));
check('no console errors in the whole walkthrough', errors.length === 0, errors.join(';'));

console.log('\n--- final summary ---\n' + full.summary);
console.log('--- final table ---\n' + full.table.join('\n'));

const phone = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const ph = await phone.newPage();
await ph.goto(URL_UNDER_TEST); await ph.click('#load'); await ph.click('#run');
const ps = await ph.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
check('phone width: no horizontal page scroll', ps[0] <= ps[1], ps.join(','));
const tableFit = await ph.evaluate(() => { const box = document.querySelector('#node-table').parentElement; return [box.scrollWidth, box.clientWidth]; });
check('phone width: every required table column is visible', tableFit[0] <= tableFit[1], tableFit.join(','));
await ph.screenshot({ path: `${out}/9-phone.png`, fullPage: true });

await b.close();
server.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
