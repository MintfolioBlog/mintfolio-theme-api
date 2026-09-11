/**
 * The public, framework-independent theme contract.
 *
 * Core constructs these values explicitly. They must never contain a raw
 * content-collection entry, an article password, or protected article text.
 * Themes receive the context as page props; this package imports no host code.
 */
export const THEME_API_VERSION = '1.0.0';

/** Image metadata usable by Astro's image pipeline without importing Astro. */
export interface PublicImage {
  src: string;
  width: number;
  height: number;
  format: 'png' | 'apng' | 'jpg' | 'jpeg' | 'tiff' | 'webp' | 'gif' | 'svg' | 'avif';
}

/** A display label and its Core-owned link; id is stable within its taxonomy. */
export interface TaxonomyTerm {
  id: string;
  label: string;
  url: string;
}

/** Frequency among published posts, including safe summaries of protected posts. */
export interface TaxonomyCount extends TaxonomyTerm {
  count: number;
}

/**
 * A calendar-month group. Month is 1–12 and id has the form YYYY-MM.
 * Version 1 provides grouped posts, not a month-specific route.
 */
export interface ArchivePeriod {
  id: string;
  label: string;
  count: number;
  year: number;
  month: number;
  posts: PostSummary[];
}

/**
 * Public post metadata. publishedAt is an ISO 8601 string, never a Date.
 * For protected posts description is Core's public placeholder. Theme code
 * must use url as supplied instead of rebuilding paths from id.
 */
export interface PostSummary {
  id: string;
  url: string;
  title: string;
  description: string;
  publishedAt: string;
  tags: TaxonomyTerm[];
  category: TaxonomyTerm;
  cover?: string | PublicImage;
  protected: boolean;
}

/** Public author data; display choices belong in the theme's own settings. */
export interface PublicProfile {
  name: string;
  avatar: string | PublicImage;
  bio: string;
  location: string;
  signature: string;
}

/** Social icon is an identifier interpreted by a theme, not executable markup. */
export interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

/** Skill proficiency is a percentage from 0 to 100. */
export interface SkillItem {
  name: string;
  level: number;
}

/** Author-maintained grouping of skills; themes choose how to present them. */
export interface SkillCategory {
  category: string;
  items: SkillItem[];
}

/** A portfolio entry; both the live and source link are optional. */
export interface Project {
  title: string;
  description: string;
  link?: string;
  repo?: string;
  tags: string[];
  image?: string;
}

/** social contains platform identifiers from PublicSite.social. */
export interface ContactInfo {
  email: string;
  social: string[];
}

/** Site content shared unchanged by all themes, without legacy layout options. */
export interface PublicSite {
  title: string;
  description: string;
  url: string;
  language: string;
  profile: PublicProfile;
  social: SocialLink[];
  skills: SkillCategory[];
  projects: Project[];
  contact: ContactInfo;
  icp?: string;
}

/** A destination supplied by Core. Themes are free to reorder or omit links. */
export interface NavigationLink {
  id: string;
  label: string;
  url: string;
}

/** URL-backed list filters. An empty string means no restriction. */
export interface PostFilters {
  q: string;
  tag: string;
  category: string;
}

/**
 * q matches title or public description, ignoring case. tag/category match
 * their display labels, ignoring case. Offset defaults to zero; omitted limit
 * returns every match. Pagination is applied after filtering and sorting.
 */
export interface PostQuery extends Partial<PostFilters> {
  offset?: number;
  limit?: number;
}

/** total is the number of matches before offset/limit, items is the requested slice. */
export interface PostPage {
  items: PostSummary[];
  total: number;
}

/**
 * Serializable matching data. createSearchEntry() lowercases title, description,
 * tags and category; id/url retain their original values. Display the original
 * PostSummary rather than these normalized values. No article body is indexed.
 */
export interface SearchEntry {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
}

/** Core owns URL encoding and route policy. All return site-relative URLs. */
export interface ThemeUrls {
  home(): string;
  archive(filters?: Partial<PostFilters>): string;
  page(id: string): string;
  post(id: string): string;
  tag(label: string): string;
  category(label: string): string;
  rss(): string;
  sitemap(): string;
}

/**
 * Build-time services injected by the host into every renderer. Settings are
 * already validated and defaulted. Calling post() for a draft/missing id returns
 * null; posts() and search.index() include only safe published metadata.
 * Do not serialize this object wholesale: it contains build-time functions.
 */
export interface ThemeContext<S = Record<string, unknown>> {
  site: PublicSite;
  navigation: NavigationLink[];
  settings: S;
  content: {
    posts(query?: PostQuery): Promise<PostPage>;
    post(id: string): Promise<PostSummary | null>;
  };
  taxonomy: {
    tags(): Promise<TaxonomyCount[]>;
    categories(): Promise<TaxonomyCount[]>;
    archives(): Promise<ArchivePeriod[]>;
  };
  urls: ThemeUrls;
  search: { index(): Promise<SearchEntry[]> };
}

/** Routed semantic pages. Search and taxonomy filters share the archive renderer. */
export type PageKind = 'home' | 'post' | 'page' | 'archive' | 'notFound';

/** Relative .astro renderer paths resolved against the theme manifest directory. */
export type ThemePages = { home: string; post: string } & Partial<Record<Exclude<PageKind, 'home' | 'post'>, string>>;

/** engine is a semver range of Theme API/Runtime versions, not Astro versions. */
export interface ThemeManifest {
  id: string;
  name: string;
  version: string;
  engine: string;
  author: string;
  description: string;
}

/** Omitted capabilities mean false. Unsupported protected posts fail the build. */
export interface ThemeCapabilities {
  search?: boolean;
  tags?: boolean;
  categories?: boolean;
  toc?: boolean;
  darkMode?: boolean;
  encryptedPosts?: boolean;
  comments?: boolean;
  i18n?: boolean;
}

/** Common UI metadata for a primitive setting; default is always required. */
interface SettingMetadata {
  label: string;
  description?: string;
}

export interface StringSetting extends SettingMetadata {
  type: 'string';
  default: string;
}

export interface BooleanSetting extends SettingMetadata {
  type: 'boolean';
  default: boolean;
}

/** Bounds are inclusive. Values and bounds must be finite numbers. */
export interface NumberSetting extends SettingMetadata {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
}

/** Options are string values; default must be one of those values. */
export interface SelectSetting extends SettingMetadata {
  type: 'select';
  default: string;
  options: readonly string[];
}

/** Hexadecimal CSS color, including #RGB, #RGBA, #RRGGBB, or #RRGGBBAA. */
export interface ColorSetting extends SettingMetadata {
  type: 'color';
  default: string;
}

/** Nested display settings are validated recursively; unknown properties are rejected. */
export interface ObjectSetting extends SettingMetadata {
  type: 'object';
  default: Record<string, unknown>;
  properties: SettingsSchema;
}

/** Ordered theme-owned content, such as recommended links or featured post ids. */
export interface ArraySetting extends SettingMetadata {
  type: 'array';
  default: readonly unknown[];
  items: SettingDefinition;
}

export type SettingDefinition = StringSetting | BooleanSetting | NumberSetting | SelectSetting | ColorSetting | ObjectSetting | ArraySetting;
export type SettingsSchema = Record<string, SettingDefinition>;

/** Infer validated settings from a const schema, including select literal unions. */
export type InferSettings<S extends SettingsSchema> = {
  -readonly [K in keyof S]: InferSetting<S[K]>;
};

type InferSetting<S extends SettingDefinition> = S extends BooleanSetting ? boolean
  : S extends NumberSetting ? number
  : S extends SelectSetting ? S['options'][number]
  : S extends ObjectSetting ? InferSettings<S['properties']>
  : S extends ArraySetting ? InferSetting<S['items']>[]
  : string;

/** Optional supported toolchains, installed by the theme and loaded only when selected. */
export interface ThemeBuildRequirements {
  react?: boolean;
  tailwind?: boolean;
}

/**
 * Declarative theme entry point. There are no registration callbacks, routing
 * hooks or host imports. The loader validates unknown input before compilation.
 */
export interface ThemeDefinition<S extends SettingsSchema = SettingsSchema> {
  manifest: ThemeManifest;
  capabilities: ThemeCapabilities;
  pages: ThemePages;
  settings: S;
  build?: ThemeBuildRequirements;
}

/** User-owned build configuration; page override paths are relative to the site root. */
export interface ThemeConfiguration {
  /** Omitted selection uses the lightweight fallback bundled with Core. */
  theme?: string;
  settings?: Record<string, unknown>;
  overrides?: { pages?: Partial<Record<PageKind, string>> };
}

/**
 * Preserve literal schema types in a theme.mjs/TypeScript manifest. This identity
 * helper does not validate external input; the host validator remains mandatory.
 * @param definition The complete declarative theme contract.
 * @returns The same definition, retaining settings inference for theme authors.
 */
export function defineTheme<const S extends SettingsSchema>(definition: ThemeDefinition<S>): ThemeDefinition<S> {
  return definition;
}

export type { EncryptedArticle } from './crypto.js';
