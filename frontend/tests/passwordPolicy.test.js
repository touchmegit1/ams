import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { passwordError } from '../src/utils/passwordPolicy.js';

const cases = JSON.parse(readFileSync(new URL('../../backend/src/test/resources/password-policy-cases.json', import.meta.url), 'utf8'));
test('password validation agrees with the backend policy fixtures', () => {
  for (const item of cases) assert.equal(passwordError(item.value) === '', item.valid);
});
test('Unicode passwords use character length, without truncating to BCrypt bytes', () => {
  assert.equal(passwordError('Áa1!' + 'ệ'.repeat(60)), '');
  assert.notEqual(passwordError('Áa1!' + 'ệ'.repeat(61)), '');
});
