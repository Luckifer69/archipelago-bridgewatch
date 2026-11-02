import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('application code never reads the documented expected values or test files', () => {
  const sources = readdirSync(new URL('../src/', import.meta.url), { recursive: true }).filter((file) => file.endsWith('.js'));
  assert.ok(sources.length > 0);
  for (const file of sources) {
    const code = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const forbidden of ['ORACLE', 'EVENTS.md', 'oracle-check', 'fixtures/', '/test/', '.test.js']) {
      const imported = code.split('\n').some((line) => /\b(import|fetch|readFile)\b/.test(line) && line.includes(forbidden));
      assert.ok(!imported, `${file} reads ${forbidden}`);
    }
  }
});
