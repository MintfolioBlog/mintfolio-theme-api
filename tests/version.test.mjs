import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { THEME_API_VERSION } from '@mintfolio/theme-api';

test('runtime contract tracks the published SDK major and minor version', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(THEME_API_VERSION.split('.').slice(0, 2), pkg.version.split('.').slice(0, 2));
});