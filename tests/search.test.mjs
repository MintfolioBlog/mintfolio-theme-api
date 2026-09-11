import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearchEntry, filterPosts, readFiltersFromUrl, searchPosts, writeFiltersToUrl } from '@mintfolio/theme-api/search';

function publicPost(id, title, description, tags, category) {
  return {
    id, url: `/blog/${id}`, title, description, publishedAt: '2026-09-01T00:00:00.000Z', protected: false,
    tags: tags.map((label) => ({ id: label, label, url: `/blog?tag=${encodeURIComponent(label)}` })),
    category: { id: category, label: category, url: `/blog?category=${encodeURIComponent(category)}` },
  };
}

test('public search matches combined filters without changing order, casing, or DTO references', () => {
  const posts = [
    publicPost('one', 'Astro Guide', 'Getting started', ['Astro', '中文'], 'Development'),
    publicPost('two', 'Daily Notes', 'An ASTRO discovery', ['Astro'], 'Journal'),
    publicPost('three', 'React Notes', 'Getting started', ['React'], 'Development'),
  ];
  const index = posts.map(createSearchEntry);
  assert.deepEqual(filterPosts(posts, { q: ' astro ' }).map((post) => post.id), ['one', 'two']);
  assert.deepEqual(searchPosts(index, { q: 'ASTRO', tag: 'aStRo', category: 'development' }).map((post) => post.id), ['one']);
  assert.deepEqual(filterPosts(posts, { tag: 'Ast' }), []);
  assert.equal(filterPosts(posts, { tag: '中文' })[0], posts[0]);
  assert.equal(searchPosts(index, { tag: '中文' })[0], index[0]);
  assert.equal(posts[0].title, 'Astro Guide');
  assert.deepEqual(filterPosts(posts), posts);
});

test('URL filter conversion handles Unicode and punctuation while preserving unrelated URL state', () => {
  const original = new URL('https://example.com/blog?q=old&tag=old&source=mail#results');
  const result = writeFiltersToUrl({ q: ' 搜索 & More ', tag: 'C++', category: '' }, original);
  assert.deepEqual(readFiltersFromUrl(result), { q: '搜索 & More', tag: 'C++', category: '' });
  assert.equal(result.searchParams.get('source'), 'mail');
  assert.equal(result.hash, '#results');
  assert.equal(result.searchParams.has('category'), false);
  assert.equal(original.searchParams.get('q'), 'old');
  assert.deepEqual(readFiltersFromUrl(result.searchParams), readFiltersFromUrl(result));
  assert.deepEqual(readFiltersFromUrl('/blog?tag=%E4%B8%AD%E6%96%87'), { q: '', tag: '中文', category: '' });
  assert.deepEqual(readFiltersFromUrl('?q=one+two'), { q: 'one two', tag: '', category: '' });
});
