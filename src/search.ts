/** Pure search and URL helpers. Safe in Node and browsers; no DOM imports. */
import type { PostFilters, PostSummary, SearchEntry } from './index.js';

/** Return a new empty filter object so callers may safely maintain their own state. */
export function emptyFilters(): PostFilters {
  return { q: '', tag: '', category: '' };
}

/**
 * Create a serializable search record from Core's safe public metadata.
 * The normalized fields are for matching only; display the original summary.
 */
export function createSearchEntry(post: PostSummary): SearchEntry {
  return {
    id: post.id,
    url: post.url,
    title: post.title.toLowerCase(),
    description: post.description.toLowerCase(),
    tags: post.tags.map((tag) => tag.label.toLowerCase()),
    category: post.category.label.toLowerCase(),
  };
}

/** Match the existing title/description substring and exact taxonomy semantics. */
function matches(entry: SearchEntry, filters: Partial<PostFilters>): boolean {
  const query = (filters.q ?? '').trim().toLowerCase();
  const tag = (filters.tag ?? '').toLowerCase();
  const category = (filters.category ?? '').toLowerCase();
  return (!query || entry.title.includes(query) || entry.description.includes(query))
    && (!tag || entry.tags.includes(tag))
    && (!category || entry.category === category);
}

/**
 * Filter safe public summaries, preserving their order and object identity.
 * An omitted/empty filter matches everything. This function does not paginate,
 * mutate inputs, read the DOM, or add full-text indexing of article bodies.
 */
export function filterPosts<T extends PostSummary>(posts: readonly T[], filters: Partial<PostFilters> = {}): T[] {
  return posts.filter((post) => matches(createSearchEntry(post), filters));
}

/** Filter records created by createSearchEntry(), retaining input order and identity. */
export function searchPosts<T extends SearchEntry>(entries: readonly T[], filters: Partial<PostFilters> = {}): T[] {
  return entries.filter((entry) => matches(entry, filters));
}

/**
 * Read filters without accessing window. Strings may be absolute/relative URLs
 * or a query beginning with '?'. Other query parameters and the hash are ignored.
 */
export function readFiltersFromUrl(input: URL | URLSearchParams | string): PostFilters {
  const params = input instanceof URLSearchParams ? input
    : input instanceof URL ? input.searchParams
    : new URL(input, 'https://mintfolio.invalid').searchParams;
  return { q: params.get('q') ?? '', tag: params.get('tag') ?? '', category: params.get('category') ?? '' };
}

/**
 * Return a new URL with q/tag/category updated; never mutate the supplied URL.
 * Empty values remove those keys. Unrelated parameters and hash are preserved.
 * Pass an absolute URL (usually new URL(location.href)) to make the origin explicit.
 */
export function writeFiltersToUrl(filters: Partial<PostFilters>, url: URL): URL {
  const result = new URL(url.href);
  for (const key of ['q', 'tag', 'category'] as const) {
    const value = (filters[key] ?? '').trim();
    if (value) result.searchParams.set(key, value);
    else result.searchParams.delete(key);
  }
  return result;
}
