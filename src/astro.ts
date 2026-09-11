/** Astro-facing page contracts. These add no layout, styles, or client router. */
import type { EncryptedArticle } from './crypto.js';
import type { PageKind, PostFilters, PostSummary, PublicProfile, ThemeContext } from './index.js';

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
}

/** Static archive HTML is filtered in the browser for query-string navigation. */
export interface ArchivePageData extends BasePageData {
  kind: 'archive';
  posts: PostSummary[];
  filters: PostFilters;
}

/** Version 1 supplies the about page from the shared public profile. */
export interface StaticPageData extends BasePageData {
  kind: 'page';
  id: string;
  profile: PublicProfile;
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
