import test from 'node:test';
import assert from 'node:assert/strict';
import * as legacy from '@mintfolio/theme-api/client';
import * as focused from '@mintfolio/theme-api/protected-article';
import { emptyFilters } from '@mintfolio/theme-api/search';

test('focused unlock entry preserves legacy function and error identity', () => {
  assert.equal(legacy.unlockArticle, focused.unlockArticle);
  assert.equal(legacy.ArticleUnlockError, focused.ArticleUnlockError);
  assert.equal(legacy.parseEncryptedArticle, focused.parseEncryptedArticle);
  assert.equal(legacy.emptyFilters, emptyFilters);
});

test('unlock rejects non-browser execution with its stable public error', async () => {
  await assert.rejects(focused.unlockArticle({}, 'password', 'article'), error =>
    error instanceof legacy.ArticleUnlockError && error.code === 'UNSUPPORTED_ENVIRONMENT');
});
