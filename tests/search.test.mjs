import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSearchEntry, filterPosts, rankSearchResults, readFiltersFromUrl, searchPosts, searchWithHighlights, writeFiltersToUrl,
} from '@mintfolio/theme-api/search';

function publicPost(id, title, description, tags = [], category = 'Development') {
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
  assert.equal(index[0].title, 'Astro Guide');
});

test('full-text AND queries span fields and combine with exact taxonomy filters, including Chinese', () => {
  const entries = [
    createSearchEntry(publicPost('full', 'Astro 入门', '搭建教程', ['中文'], 'Development'), '正文讲解静态博客全文搜索。'),
    createSearchEntry(publicPost('missing-term', 'Astro 入门', '搭建教程', ['中文'], 'Development'), '只有正文。'),
    createSearchEntry(publicPost('wrong-category', 'Astro 入门', '搭建教程', ['中文'], 'Journal'), '全文搜索。'),
  ];
  assert.deepEqual(searchPosts(entries, { q: ' ASTRO   全文 搜索 ', tag: '中文', category: 'development' }).map((entry) => entry.id), ['full']);
  assert.equal(searchPosts(entries, { q: '静态博客' })[0], entries[0]);
  assert.deepEqual(searchPosts(entries, { q: 'Astro 不存在' }), []);
  assert.deepEqual(filterPosts([publicPost('metadata', 'Astro', 'search engine')], { q: 'Astro search' }).map((post) => post.id), ['metadata']);
  assert.deepEqual(searchPosts(entries, { q: ' \t ', category: 'Development' }), entries.slice(0, 2));
  // Older normalized index JSON continues to work.
  assert.equal(searchPosts([{ ...entries[0], title: 'astro 入门', category: 'development' }], { q: 'ASTRO', category: 'DEVELOPMENT' }).length, 1);
});

test('protected articles never serialize or match supplied private body text', () => {
  const protectedPost = { ...publicPost('locked', 'Public title', 'Public description'), protected: true };
  const protectedEntry = createSearchEntry(protectedPost, 'SECRET_PRIVATE_BODY');
  assert.equal(Object.hasOwn(protectedEntry, 'text'), false);
  assert.equal(JSON.stringify(protectedEntry).includes('SECRET_PRIVATE_BODY'), false);
  assert.deepEqual(searchWithHighlights([protectedEntry], { q: 'SECRET_PRIVATE_BODY' }), []);
  assert.equal(searchPosts([protectedEntry], { q: 'Public title' })[0], protectedEntry);
  assert.equal(Object.hasOwn([protectedPost].map(createSearchEntry)[0], 'text'), false);
  assert.equal(Object.hasOwn([publicPost('open', 'Title', '')].map(createSearchEntry)[0], 'text'), false);
});

test('relevance favors exact titles then title phrases, summaries and body without mutating source order', () => {
  const entries = Object.freeze([
    createSearchEntry(publicPost('body', 'Other', 'Another'), 'Astro search '.repeat(500)),
    createSearchEntry(publicPost('description', 'Other', 'Astro search')),
    createSearchEntry(publicPost('title-phrase', 'An Astro search guide', '')),
    createSearchEntry(publicPost('exact-first', 'Astro search', '')),
    createSearchEntry(publicPost('exact-second', 'ASTRO SEARCH', '')),
  ].map(Object.freeze));
  const filters = { q: 'astro search' };
  assert.deepEqual(rankSearchResults(entries, filters).map((entry) => entry.id), ['exact-first', 'exact-second', 'title-phrase', 'description', 'body']);
  assert.deepEqual(searchPosts(entries, filters), entries);
  assert.deepEqual(rankSearchResults(entries), entries);
  assert.deepEqual(searchWithHighlights(entries).map(({ entry }) => entry), entries);
  assert.deepEqual(searchWithHighlights(entries, filters).map(({ entry }) => entry), rankSearchResults(entries, filters));
  assert.equal(rankSearchResults(entries, filters)[0], entries[3]);
});

test('highlight ranges preserve original text, merge overlaps and never generate HTML', () => {
  const entry = createSearchEntry(
    publicPost('unicode', 'İzmir 😀 中文搜索', 'Mixed CASE'),
    '这是一段中文搜索内容，<script>alert(1)</script> 始终是纯文本。',
  );
  const [result] = searchWithHighlights([entry], { q: 'zmir 中文 搜索' });
  assert.equal(result.entry, entry);
  assert.deepEqual(result.matches.title.map(({ start, end }) => entry.title.slice(start, end)), ['zmir', '中文搜索']);
  assert.equal(result.snippet.field, 'text');
  assert.equal(result.snippet.text, entry.text);
  assert.equal(result.snippet.text.includes('<script>alert(1)</script>'), true);
  assert.deepEqual(result.snippet.ranges.map(({ start, end }) => result.snippet.text.slice(start, end)), ['中文搜索']);
  assert.equal(Object.hasOwn(result, 'html'), false);
  const [summaryResult] = searchWithHighlights([entry], { q: 'mixed case' });
  assert.equal(summaryResult.snippet.text, 'Mixed CASE');
  assert.deepEqual(summaryResult.matches.description, [{ start: 0, end: 5 }, { start: 6, end: 10 }]);
});

test('snippets stay bounded around late matches and expose source offsets without splitting emoji', () => {
  const source = '😀'.repeat(220) + '中文搜索' + '😀'.repeat(100);
  const entry = createSearchEntry(publicPost('long', 'Title', ''), source);
  const [result] = searchWithHighlights([entry], { q: '中文 搜索' }, { snippetLength: 50 });
  assert.ok(result.snippet.text.length <= 50);
  assert.ok(result.snippet.start > 0);
  assert.equal(result.snippet.text, source.slice(result.snippet.start, result.snippet.end));
  assert.deepEqual(result.snippet.ranges.map(({ start, end }) => result.snippet.text.slice(start, end)), ['中文搜索']);
  assert.equal(result.snippet.text.isWellFormed(), true);
  for (const snippetLength of [0, -1, Infinity, NaN, 1_000_000]) {
    const [bounded] = searchWithHighlights([entry], { q: '中文' }, { snippetLength });
    assert.ok(bounded.snippet.text.length <= 500);
    assert.equal(bounded.snippet.text.includes('中文'), true);
  }
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

test('series filters intersect full-text and taxonomy filters while older entries remain valid', () => {
  const one = { ...publicPost('one', 'Astro guide', '', ['Web'], 'Development'), series: { id: 'Guide', label: 'Guide', url: '/series/Guide', order: 1 } };
  const two = { ...publicPost('two', 'Astro notes', '', ['Web'], 'Journal'), series: one.series };
  const legacy = publicPost('legacy', 'Astro legacy', '', ['Web'], 'Development');
  const posts = [one, two, legacy];
  const index = posts.map(post => createSearchEntry(post, 'Unique body keyword'));
  const filters = { series: 'gUiDe', category: 'development', tag: 'web' };
  assert.deepEqual(filterPosts(posts, filters), [one]);
  assert.deepEqual(searchPosts(index, { ...filters, q: 'unique' }), [index[0]]);
  assert.deepEqual(searchWithHighlights(index, { ...filters, q: 'unique' }).map(result => result.entry), [index[0]]);
  assert.deepEqual(rankSearchResults(index, { series: 'guide' }), index.slice(0, 2));
  assert.deepEqual(searchPosts(index, { series: 'missing' }), []);
  assert.deepEqual(searchPosts(index, { series: '' }), index);
  assert.equal(Object.hasOwn(index[2], 'series'), false);
  assert.equal(index[0].series, 'Guide');
});

test('series URL filters round-trip Unicode and clear without altering unrelated state', () => {
  const original = new URL('https://example.com/blog?source=mail#results');
  const next = writeFiltersToUrl({ series: ' 中文 & Guide ' }, original);
  assert.equal(readFiltersFromUrl(next).series, '中文 & Guide');
  assert.equal(next.searchParams.get('source'), 'mail');
  assert.equal(next.hash, '#results');
  assert.equal(original.searchParams.has('series'), false);
  const cleared = writeFiltersToUrl({ series: '' }, next);
  assert.equal(cleared.searchParams.has('series'), false);
  assert.deepEqual(readFiltersFromUrl(cleared), { q: '', tag: '', category: '' });
});
