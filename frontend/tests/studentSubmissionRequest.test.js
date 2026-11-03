import test from 'node:test';
import assert from 'node:assert/strict';
import api from '../src/services/api.js';
import { saveSession } from '../src/services/authSession.js';

test('multipart student submission carries the current tab bearer and leaves multipart encoding to Axios/browser', async () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  const storage = new Map();
  globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  saveSession(token, { role: 'STUDENT' });

  let request;
  const form = new FormData();
  form.append('submissionText', 'answer');
  await api.post('/student/assignments/4/submission', form, {
    adapter: async (config) => {
      request = config;
      return { data: {}, status: 201, statusText: 'Created', headers: {}, config };
    },
  });

  assert.equal(request.headers.get('Authorization'), `Bearer ${token}`);
  assert.ok(request.data instanceof FormData, 'Axios must preserve the FormData body');
  assert.match(request.headers.get('Content-Type'), /^multipart\/form-data/);
});
