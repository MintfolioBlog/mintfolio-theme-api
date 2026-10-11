/** Astro-facing page contracts. These add no layout, styles, or client router. */
import type { EncryptedArticle } from './crypto.js';
import type { PageKind, PostFilters, PostSummary, PublicProfile, ThemeContext, ThemeDefinition, InferSettings } from './index.js';

export type { PageKind } from './index.js';

/** Heading text is plain text; render through normal escaping, never set:html. */
export interface ArticleHeading {
  depth: number;
  slug: string;
  text: string;
}

/**
 * Versioned plaintext inside the authenticated encrypted envelope. This is an
 * intermediate value owned by Core and the unlock helper, never a page prop.
 */
export interface ArticleContent {
  version: 1;
  html: string;
  headings: ArticleHeading[];
}

/**
 * Body prepared by Core. Protected bodies expose only authenticated ciphertext;
 * their headings and plaintext cannot appear in the generated page or props.
 */
export type ArticleBody =
  | { kind: 'public'; html: string; headings: ArticleHeading[] }
  | { kind: 'protected'; postId: string; payload: EncryptedArticle };

/** Core's SEO policy, rendered in a theme's own head with the optional helper. */
export interface SeoData {
  title: string;
  description: string;
  language: string;
  canonical: string;
  robots: 'index,follow' | 'noindex,nofollow';
  image?: string;
  type?: 'website' | 'article';
  siteName?: string;
  publishedAt?: string;
  modifiedAt?: string;
  imageAlt?: string;
  authors?: string[];
  twitterCard?: 'summary' | 'summary_large_image';
  twitterSite?: string;
  jsonLd?: Record<string, unknown>;
  feeds?: { rss: string; json: string; atom?: string };
}

/** Common fields are retained even when a missing optional renderer uses fallback. */
export interface BasePageData {
  kind: PageKind;
  title: string;
  description: string;
  url: string;
  seo: SeoData;
}

export interface HomePageData extends BasePageData {
  kind: 'home';
  posts: PostSummary[];
}

/** previous/next follow Core's publication ordering and are null at either end. */
export interface PostPageData extends BasePageData {
  kind: 'post';
  post: PostSummary;
  body: ArticleBody;
  previous: PostSummary | null;
  next: PostSummary | null;
  related?: PostSummary[];
  seriesPosts?: PostSummary[];
}

/** Crawlable archive navigation. The first page uses the unsuffixed archive URL. */
export interface Pagination {
  current: number; totalPages: number; totalItems: number; pageSize: number;
  previous: string | null; next: string | null;
  pages: { number: number; url: string }[];
}

/** One page of a crawlable archive; browser search independently loads the full public index. */
export interface ArchivePageData extends BasePageData {
  kind: 'archive';
  posts: PostSummary[];
  filters: PostFilters;
  pagination?: Pagination;
  taxonomy?: { kind: 'tag' | 'category' | 'series'; label: string };
}

/** Standalone Markdown pages carry body; the built-in about page uses the shared profile. */
export interface StaticPageData extends BasePageData {
  kind: 'page';
  id: string;
  profile: PublicProfile;
  body?: Extract<ArticleBody, { kind: 'public' }>;
  updatedAt?: string;
  /** True only for a draft Markdown page rendered by explicit local preview. */
  preview?: boolean;
}

export interface NotFoundPageData extends BasePageData {
  kind: 'notFound';
}

export type ListPageData = ArchivePageData;
export type PageData = HomePageData | PostPageData | StaticPageData | ListPageData | NotFoundPageData;

/**
 * Every renderer receives exactly these two top-level inputs. Specialize P for
 * its page kind and S with InferSettings<typeof definition.settings> or the
 * theme's documented settings extension. No host-specific globals are needed.
 */
export interface PageProps<S = Record<string, unknown>, P extends PageData = PageData> {
  theme: ThemeContext<S>;
  page: P;
}

/** Resolve a renderer's discriminated data type from its page kind. */
export type PageDataFor<K extends PageKind> = Extract<PageData, { kind: K }>;

/** Infer validated settings and page data from the theme manifest, without repeating a settings interface. */
export type ThemePageProps<D extends ThemeDefinition, K extends PageKind = PageKind> =
  PageProps<InferSettings<D['settings']>, PageDataFor<K>>;
