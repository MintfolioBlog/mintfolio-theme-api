/** Pure search and URL helpers. Safe in Node and browsers; no DOM imports. */
import type {
  PostFilters, PostSummary, SearchEntry, SearchHighlightOptions, SearchRange, SearchResult, SearchSnippet,
} from './index.js';

/** Return a new empty filter object so callers may safely maintain their own state. */
export function emptyFilters(): PostFilters {
  return { q: '', tag: '', category: '' };
}

/**
 * Create a serializable search record from safe public metadata and optional
 * already-extracted body text. Protected articles always discard bodyText.
 * Strings retain their casing for safe plain-text rendering; matching ignores
 * case. This function does not read files, render Markdown or sanitize HTML.
 */
export function createSearchEntry(post: PostSummary): SearchEntry;
export function createSearchEntry(post: PostSummary, bodyText?: string): SearchEntry;
export function createSearchEntry(post: PostSummary, bodyText?: string): SearchEntry {
  return {
    id: post.id,
    url: post.url,
    title: post.title,
    description: post.description,
    tags: post.tags.map((tag) => tag.label),
    category: post.category.label,
    ...(post.series ? { series: post.series.label } : {}),
    // Array.map(createSearchEntry) supplies an index, never article body text.
    ...(!post.protected && typeof bodyText === 'string' && bodyText ? { text: bodyText } : {}),
  };
}

type Fields = Record<'title' | 'description' | 'text', string>;

function queryTerms(filters: Partial<PostFilters>): { phrase: string; terms: string[] } {
  const phrase = (filters.q ?? '').trim().toLowerCase().replace(/\s+/gu, ' ');
  return { phrase, terms: [...new Set(phrase.split(' ').filter(Boolean))] };
}

function normalizedFields(entry: SearchEntry): Fields {
  return {
    title: entry.title.toLowerCase(),
    description: entry.description.toLowerCase(),
    text: (entry.text ?? '').toLowerCase(),
  };
}

function matchesTaxonomy(entry: SearchEntry, filters: Partial<PostFilters>): boolean {
  const tag = (filters.tag ?? '').toLowerCase();
  const category = (filters.category ?? '').toLowerCase();
  const series = (filters.series ?? '').toLowerCase();
  return (!tag || entry.tags.some((label) => label.toLowerCase() === tag))
    && (!category || entry.category.toLowerCase() === category)
    && (!series || entry.series?.toLowerCase() === series);
}

function matchesTerms(fields: Fields, terms: readonly string[]): boolean {
  return terms.every((term) => fields.title.includes(term) || fields.description.includes(term) || fields.text.includes(term));
}

/**
 * Filter public summaries by title/description and exact taxonomy labels,
 * preserving order and object identity. Whitespace-separated query terms use
 * AND semantics across fields. Summary filtering does not index body text;
 * use searchPosts or searchWithHighlights on Core's search index for full text.
 */
export function filterPosts<T extends PostSummary>(posts: readonly T[], filters: Partial<PostFilters> = {}): T[] {
  const { terms } = queryTerms(filters);
  return posts.filter((post) => {
    const entry = createSearchEntry(post);
    return matchesTaxonomy(entry, filters) && matchesTerms(normalizedFields(entry), terms);
  });
}

/**
 * Filter index records by title, description and optional body text. Retains
 * input order and identity; empty queries apply only exact taxonomy filters.
 * Multiword queries require every term, including Chinese substrings.
 */
export function searchPosts<T extends SearchEntry>(entries: readonly T[], filters: Partial<PostFilters> = {}): T[] {
  const { terms } = queryTerms(filters);
  return entries.filter((entry) => matchesTaxonomy(entry, filters) && matchesTerms(normalizedFields(entry), terms));
}

/** Score a complete match. Weights are bounded by query size and body length. */
function relevance(fields: Fields, phrase: string, terms: readonly string[]): number {
  if (!terms.length) return 0;
  let score = 0;
  for (const term of terms) {
    // Count each term once in its strongest field; repetition cannot stuff ranks.
    score += fields.title.includes(term) ? 30 : fields.description.includes(term) ? 10 : 1;
  }
  score /= terms.length;
  if (fields.title === phrase) score += 1000;
  else if (fields.title.includes(phrase)) score += 200;
  else if (fields.description === phrase) score += 100;
  else if (fields.description.includes(phrase)) score += 60;
  else if (fields.text.includes(phrase)) score += 10;
  return score;
}

function rankedEntries<T extends SearchEntry>(entries: readonly T[], filters: Partial<PostFilters>) {
  const { phrase, terms } = queryTerms(filters);
  return entries.flatMap((entry, index) => {
    if (!matchesTaxonomy(entry, filters)) return [];
    const fields = normalizedFields(entry);
    return matchesTerms(fields, terms) ? [{ entry, score: relevance(fields, phrase, terms), index }] : [];
  }).sort((left, right) => right.score - left.score || left.index - right.index);
}

/**
 * Return matching records in relevance order without mutating inputs. Exact
 * title and phrase matches rank first, then title > description > body terms.
 * Ties and empty queries preserve source order; no pagination is applied.
 */
export function rankSearchResults<T extends SearchEntry>(entries: readonly T[], filters: Partial<PostFilters> = {}): T[] {
  return rankedEntries(entries, filters).map(({ entry }) => entry);
}

/** Map lowercase positions back to original UTF-16 text, including case expansions. */
function matchingRanges(text: string, terms: readonly string[]): SearchRange[] {
  if (!text || !terms.length) return [];
  const lower = text.toLowerCase();
  const starts: number[] = [];
  const ends: number[] = [];
  let originalOffset = 0;
  for (const character of text) {
    const end = originalOffset + character.length;
    for (let offset = 0; offset < character.toLowerCase().length; offset += 1) {
      starts.push(originalOffset);
      ends.push(end);
    }
    originalOffset = end;
  }
  const ranges: SearchRange[] = [];
  for (const term of terms) {
    let offset = lower.indexOf(term);
    while (offset !== -1) {
      ranges.push({ start: starts[offset], end: ends[offset + term.length - 1] });
      offset = lower.indexOf(term, offset + 1);
    }
  }
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: SearchRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** Keep slice boundaries outside UTF-16 surrogate pairs. */
function safeBoundary(text: string, offset: number, direction: -1 | 1): number {
  if (offset > 0 && offset < text.length
    && /[\uD800-\uDBFF]/u.test(text[offset - 1]) && /[\uDC00-\uDFFF]/u.test(text[offset])) {
    return offset + direction;
  }
  return offset;
}

function makeSnippet(entry: SearchEntry, matches: SearchResult['matches'], requestedLength?: number): SearchSnippet {
  const limit = Number.isFinite(requestedLength) ? Math.min(500, Math.max(32, Math.floor(requestedLength!))) : 160;
  const field = matches.text.length ? 'text' : matches.description.length ? 'description' : matches.title.length ? 'title'
    : entry.description ? 'description' : entry.text ? 'text' : 'title';
  const source = entry[field] ?? '';
  const first = matches[field][0];
  let start = first ? Math.max(0, first.start - Math.floor(limit / 4)) : 0;
  start = Math.min(start, Math.max(0, source.length - limit));
  start = safeBoundary(source, start, 1);
  const end = safeBoundary(source, Math.min(source.length, start + limit), -1);
  return {
    field, text: source.slice(start, end), start, end,
    ranges: matches[field].filter((range) => range.end > start && range.start < end)
      .map((range) => ({ start: Math.max(range.start, start) - start, end: Math.min(range.end, end) - start })),
  };
}

/**
 * Rank full-text matches and return original-text ranges plus a bounded snippet.
 * Range ends are exclusive UTF-16 positions usable with String.slice(). Match
 * positions address the original entry field; snippet ranges address snippet.text.
 * No HTML is produced: render text nodes and wrap ranges with your own markup.
 */
export function searchWithHighlights<T extends SearchEntry>(
  entries: readonly T[], filters: Partial<PostFilters> = {}, options: SearchHighlightOptions = {},
): SearchResult<T>[] {
  const { terms } = queryTerms(filters);
  return rankedEntries(entries, filters).map(({ entry, score }) => {
    const matches = {
      title: matchingRanges(entry.title, terms),
      description: matchingRanges(entry.description, terms),
      text: matchingRanges(entry.text ?? '', terms),
    };
    return { entry, score, matches, snippet: makeSnippet(entry, matches, options.snippetLength) };
  });
}

/**
 * Read filters without accessing window. Strings may be absolute/relative URLs
 * or a query beginning with '?'. Other query parameters and the hash are ignored.
 */
export function readFiltersFromUrl(input: URL | URLSearchParams | string): PostFilters {
  const params = input instanceof URLSearchParams ? input
    : input instanceof URL ? input.searchParams
    : new URL(input, 'https://mintfolio.invalid').searchParams;
  return { q: params.get('q') ?? '', tag: params.get('tag') ?? '', category: params.get('category') ?? '',
    ...(params.has('series') ? { series: params.get('series') ?? '' } : {}) };
}

/**
 * Return a new URL with q/tag/category/series updated; never mutate the supplied URL.
 * Empty values remove those keys. Unrelated parameters and hash are preserved.
 * Pass an absolute URL (usually new URL(location.href)) to make the origin explicit.
 */
export function writeFiltersToUrl(filters: Partial<PostFilters>, url: URL): URL {
  const result = new URL(url.href);
  for (const key of ['q', 'tag', 'category', 'series'] as const) {
    const value = (filters[key] ?? '').trim();
    if (value) result.searchParams.set(key, value);
    else result.searchParams.delete(key);
  }
  return result;
}