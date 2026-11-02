import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSession, getAccessToken, restoreSession, saveSession, updateSessionUser } from '../src/services/authSession.js';

const values = new Map();
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
globalThis.localStorage = { removeItem: () => {} };
globalThis.window = { dispatchEvent: () => {} };

const tokenWithExpiry = (expiry) => `header.${Buffer.from(JSON.stringify({ exp: expiry })).toString('base64url')}.signature`;

test('restores a valid session for all three roles and clears it on logout', () => {
  const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600);
  for (const role of ['STUDENT', 'TEACHER', 'ADMIN']) {
    const user = { role, fullName: role };
    saveSession(token, user);
    assert.deepEqual(restoreSession(), { accessToken: token, user });
    assert.equal(getAccessToken(), token);
    updateSessionUser({ ...user, fullName: 'Updated' });
    assert.equal(restoreSession().user.fullName, 'Updated');
    clearSession();
    assert.equal(restoreSession(), null);
  }
});

test('rejects an expired session on reload', () => {
  saveSession(tokenWithExpiry(Math.floor(Date.now() / 1000) - 60), { role: 'STUDENT' });
  assert.equal(restoreSession(), null);
  assert.equal(getAccessToken(), null);
});
