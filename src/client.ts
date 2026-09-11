/** Opt-in browser helpers; pure build-time search is also available at /search. */
import DOMPurify from 'dompurify';
import { decryptArticle, parseEncryptedArticle } from './crypto.js';
import type { ArticleContent, ArticleHeading } from './astro.js';

export { createSearchEntry, emptyFilters, filterPosts, readFiltersFromUrl, searchPosts, writeFiltersToUrl } from './search.js';
export { parseEncryptedArticle } from './crypto.js';

/** Stable codes allow a theme to supply localized feedback without parsing messages. */
export type UnlockErrorCode = 'UNSUPPORTED_ENVIRONMENT' | 'INVALID_ENCRYPTED_ARTICLE' | 'AUTHENTICATION_FAILED' | 'INVALID_ARTICLE_CONTENT';

/** No password, ciphertext, plaintext, or crypto exception is included in an error. */
export class ArticleUnlockError extends Error {
  readonly code: UnlockErrorCode;

  constructor(code: UnlockErrorCode, message: string) {
    super(message);
    this.name = 'ArticleUnlockError';
    this.code = code;
  }
}

/**
 * Sanitized, ephemeral article content. Attach fragment using replaceChildren();
 * render heading text normally. The theme must clear both content and headings
 * on relock/navigation and discard any unlock result completed after disposal.
 */
export interface UnlockedArticle {
  fragment: DocumentFragment;
  headings: ArticleHeading[];
}

/** Accept only Core's versioned data protocol, never the legacy theme-HTML payload. */
function parseArticleContent(value: unknown): ArticleContent {
  const invalid = (): never => {
    throw new ArticleUnlockError('INVALID_ARTICLE_CONTENT', 'The decrypted article format is not supported.');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const content = value as Partial<ArticleContent>;
  if (content.version !== 1 || typeof content.html !== 'string' || !Array.isArray(content.headings)) return invalid();
  const headings = content.headings.map((heading: unknown): ArticleHeading => {
    if (!heading || typeof heading !== 'object' || Array.isArray(heading)) return invalid();
    const item = heading as Partial<ArticleHeading>;
    if (typeof item.depth !== 'number' || !Number.isInteger(item.depth) || item.depth < 1 || item.depth > 6
      || typeof item.slug !== 'string' || !item.slug || typeof item.text !== 'string') return invalid();
    return { depth: item.depth, slug: item.slug, text: item.text };
  });
  return { version: 1, html: content.html, headings };
}

/**
 * Authenticate an encrypted article, validate its content protocol, then sanitize
 * the body before returning DOM nodes. Web Crypto requires a secure browser
 * context (HTTPS or localhost). This helper never stores passwords or plaintext.
 *
 * @param payload Untrusted JSON decoded from the protected page's ciphertext.
 * @param password The current password input. Caller clears the input afterwards.
 * @param postId Core's exact post id, authenticated along with the ciphertext.
 * @returns Sanitized body nodes and plain-text headings, for ephemeral mounting.
 * @throws ArticleUnlockError with a stable code for invalid data or authentication.
 */
export async function unlockArticle(payload: unknown, password: string, postId: string): Promise<UnlockedArticle> {
  if (typeof document === 'undefined' || !globalThis.crypto?.subtle || typeof DOMPurify.sanitize !== 'function') {
    throw new ArticleUnlockError('UNSUPPORTED_ENVIRONMENT', 'Article unlocking requires a secure browser context.');
  }
  let encrypted;
  try {
    encrypted = parseEncryptedArticle(payload);
  } catch {
    throw new ArticleUnlockError('INVALID_ENCRYPTED_ARTICLE', 'The encrypted article is malformed or unsupported.');
  }
  let plaintext: string;
  try {
    plaintext = await decryptArticle(encrypted, password, postId);
  } catch {
    throw new ArticleUnlockError('AUTHENTICATION_FAILED', 'The password is incorrect or the article has been modified.');
  }
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    throw new ArticleUnlockError('INVALID_ARTICLE_CONTENT', 'The decrypted article format is not supported.');
  }
  const content = parseArticleContent(value);
  return {
    fragment: DOMPurify.sanitize(content.html, { RETURN_DOM_FRAGMENT: true }),
    headings: content.headings,
  };
}
