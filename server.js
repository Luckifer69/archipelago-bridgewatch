// Browsers block JavaScript modules opened directly from disk, so the app needs a small local server.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT ?? 8000);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

// Only the app itself is served, so the page can't reach the documented answers or the tests.
function isAppFile(pathname) {
  const insideApp = pathname === '/index.html' || pathname === '/styles.css' || pathname.startsWith('/src/');
  return insideApp && !pathname.split('/').includes('..') && extname(pathname) in CONTENT_TYPES;
}

async function handle(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  if (!isAppFile(pathname)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const body = await readFile(join(ROOT, pathname));
    response.writeHead(200, { 'Content-Type': CONTENT_TYPES[extname(pathname)] }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

export const createAppServer = () => createServer(handle);
export default handle;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Local only: there is nothing here that needs to be reachable from other machines.
  createAppServer().listen(PORT, '127.0.0.1', () => {
    console.log(`Treasure-Island Bridge Safety Map: http://localhost:${PORT}/`);
  });
}
