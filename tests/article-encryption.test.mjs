import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptArticle, encryptArticle, parseEncryptedArticle } from '@mintfolio/theme-api/crypto';

test('article encryption round-trips Unicode with unique salt and IV, without exposing the password', async () => {
  const password = '用长口令管理每一篇文章 🔐';
  const html = '<h2>私密目录</h2><p>多行内容\n空白与 emoji 🌱</p>';
  const first = await encryptArticle(html, password, 'private/example');
  const second = await encryptArticle(html, password, 'private/example');
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(await decryptArticle(first, password, 'private/example'), html);
  assert.equal(JSON.stringify(first).includes(password), false);
  assert.equal(JSON.stringify(first).includes('私密目录'), false);
});

test('wrong passwords, another article identity and altered ciphertext cannot authenticate', async () => {
  const payload = await encryptArticle('confidential body', 'sample-password-long', 'one');
  await assert.rejects(decryptArticle(payload, 'wrong-password', 'one'));
  await assert.rejects(decryptArticle(payload, 'sample-password-long', 'two'));
  const bytes = Buffer.from(payload.ciphertext, 'base64');
  bytes[0] ^= 1;
  await assert.rejects(decryptArticle({ ...payload, ciphertext: bytes.toString('base64') }, 'sample-password-long', 'one'));
  assert.throws(() => parseEncryptedArticle({ ...payload, iterations: 1 }));
  await assert.rejects(encryptArticle('body', '  ', 'one'));
});


test('untrusted crypto envelopes reject unsupported protocols and truncated or malformed binary fields', async () => {
  const valid = await encryptArticle('Protected content', 'long-test-password', 'original');
  assert.equal(parseEncryptedArticle(valid), valid);
  const invalid = [null, [], { ...valid, version: 2 }, { ...valid, kdf: 'PBKDF2-SHA1' },
    { ...valid, iterations: 600001 }, { ...valid, salt: Buffer.alloc(15).toString('base64') },
    { ...valid, iv: Buffer.alloc(11).toString('base64') }, { ...valid, ciphertext: Buffer.alloc(15).toString('base64') },
    { ...valid, salt: 'not-base64!' }, { ...valid, ciphertext: null }];
  for (const payload of invalid) {
    assert.throws(() => parseEncryptedArticle(payload));
    await assert.rejects(decryptArticle(payload, 'long-test-password', 'original'));
  }
});
