import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { after, before, test } from 'node:test';
import { createAppServer } from '../server.js';

let server;
let base;

before(async () => {
  server = createAppServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// fetch normalises '..' away, so a traversal attempt has to be sent as a raw request.
function rawStatus(path) {
  return new Promise((resolve, reject) => {
    const socket = connect(server.address().port, '127.0.0.1', () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
    });
    let reply = '';
    socket.on('data', (chunk) => { reply += chunk; });
    socket.on('end', () => resolve(Number(reply.split(' ')[1])));
    socket.on('error', reject);
  });
}

test('serves the page and modules with the right content types', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Treasure-Island Bridge Safety Map/);

  const moduleFile = await fetch(`${base}/src/engine/lowlink.js`);
  assert.equal(moduleFile.status, 200);
  assert.match(moduleFile.headers.get('content-type'), /text\/javascript/);
  await moduleFile.text();

  const styles = await fetch(`${base}/styles.css`);
  assert.equal(styles.status, 200);
  assert.match(styles.headers.get('content-type'), /text\/css/);
  await styles.text();
});

test('does not serve anything outside the app', async () => {
  for (const path of ['/docs/ORACLE.md', '/fixtures/graphs.js', '/test/replay.test.js', '/package.json', '/server.js', '/src/missing.js']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 404, path);
    await response.text();
  }
});

test('rejects path traversal and malformed paths', async () => {
  assert.equal(await rawStatus('/src/../package.json'), 404);
  assert.equal(await rawStatus('/src/%2e%2e/package.json'), 404);
  assert.equal(await rawStatus('/src/%2e%2e/%2e%2e/etc/passwd.js'), 404);
  assert.equal(await rawStatus('/src/%E0%A4%A.js'), 400);
});
