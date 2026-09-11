/**
 * Portable Web Crypto envelope, shared by the build and the browser.
 * Salt, IV and ciphertext are base64 strings. The fixed PBKDF2 iteration count
 * and exact post id are also authenticated, so a payload cannot be reassigned
 * to another article. This version retains the site's original crypto format.
 */
export interface EncryptedArticle {
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const ITERATIONS = 600_000;
const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function authenticatedContext(postId: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`personal-site:article:v1:PBKDF2-SHA256:${ITERATIONS}:${postId}`);
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt UTF-8 content during rendering/build with a fresh salt and nonce.
 * The html parameter historically contained HTML; Theme API v1 callers pass a
 * serialized ArticleContent envelope instead, without changing the algorithm.
 * @param html Plaintext content, consumed only in memory.
 * @param password Nonblank article password from the private content collection.
 * @param postId Stable article id, required unchanged when decrypting.
 * @returns An authenticated envelope containing no password or plaintext.
 * @throws Error when the password is blank; Web Crypto errors propagate.
 */
export async function encryptArticle(html: string, password: string, postId: string): Promise<EncryptedArticle> {
  if (!password.trim()) throw new Error('文章密码不能为空');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128, additionalData: authenticatedContext(postId) },
    key,
    encoder.encode(html),
  );
  return { version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

/**
 * Validate the supported crypto version, KDF parameters and decoded byte sizes.
 * This only checks format; decryptArticle performs authenticity verification.
 * @param value Untrusted JSON from an article page.
 * @returns The envelope when valid; throws for unsupported or incomplete data.
 */
export function parseEncryptedArticle(value: unknown): EncryptedArticle {
  if (!value || typeof value !== 'object') throw new Error('不支持的加密文章格式');
  const data = value as Partial<EncryptedArticle>;
  if (data.version !== 1 || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== ITERATIONS ||
    typeof data.salt !== 'string' || typeof data.iv !== 'string' || typeof data.ciphertext !== 'string') {
    throw new Error('不支持的加密文章格式');
  }
  if (fromBase64(data.salt).length !== 16 || fromBase64(data.iv).length !== 12 || fromBase64(data.ciphertext).length < 16) {
    throw new Error('加密文章数据不完整');
  }
  return data as EncryptedArticle;
}

/**
 * Authenticate and decrypt an envelope using its original password and post id.
 * Authentication failure rejects before any plaintext is returned. This is a
 * low-level primitive: browser renderers should use /client unlockArticle(),
 * which additionally validates the content protocol and sanitizes HTML.
 */
export async function decryptArticle(data: EncryptedArticle, password: string, postId: string): Promise<string> {
  parseEncryptedArticle(data);
  const key = await deriveKey(password, fromBase64(data.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(data.iv), tagLength: 128, additionalData: authenticatedContext(postId) },
    key,
    fromBase64(data.ciphertext),
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}
