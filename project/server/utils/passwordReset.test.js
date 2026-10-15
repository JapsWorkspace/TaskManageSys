const test = require('node:test');
const assert = require('node:assert/strict');

const { generatePasswordResetCode } = require('./passwordReset');

test('generatePasswordResetCode creates a 10 character code', () => {
  const code = generatePasswordResetCode();

  assert.match(code, /^[a-f0-9]{10}$/);
});
