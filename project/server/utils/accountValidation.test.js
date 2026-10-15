const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateAccountName,
  validateAccountEmail,
  validateAccountPassword,
  validatePhone,
  validateUsername,
} = require('./accountValidation');

test('validateAccountName mirrors frontend name limits', () => {
  assert.equal(validateAccountName('', 'First name'), 'First name is required.');
  assert.equal(validateAccountName('a'.repeat(41), 'First name'), 'First name must be 40 characters or fewer.');
  assert.equal(validateAccountName('Justin', 'First name'), null);
});

test('validateUsername mirrors frontend username limits', () => {
  assert.equal(validateUsername(''), 'Username is required.');
  assert.equal(validateUsername('ab'), 'Username must be 3-20 characters.');
  assert.equal(validateUsername('a'.repeat(21)), 'Username must be 3-20 characters.');
  assert.equal(validateUsername('bad name'), 'Username can only use letters, numbers, underscores, or dots.');
  assert.equal(validateUsername('valid.name_1'), null);
});

test('validateAccountEmail mirrors frontend email limits', () => {
  assert.equal(validateAccountEmail(''), 'Email is required.');
  assert.equal(validateAccountEmail('not-an-email'), 'Enter a valid email address.');
  assert.equal(validateAccountEmail('justinrainejustinraineabc@example.com'), 'Email must be 34 characters or fewer.');
  assert.equal(validateAccountEmail('justinrainejustin@example.com'), null);
  assert.equal(validateAccountEmail('justin@gmail.com'), null);
});

test('validatePhone mirrors frontend phone limits', () => {
  assert.equal(validatePhone(''), 'Phone number is required.');
  assert.equal(validatePhone('09123abc123'), 'Phone number can only contain digits.');
  assert.equal(validatePhone('123'), 'Phone number must be 7-15 digits.');
  assert.equal(validatePhone('09123451234'), null);
});

test('validateAccountPassword requires frontend password strength', () => {
  assert.equal(validateAccountPassword(''), 'Password is required.');
  assert.equal(validateAccountPassword('short1!'), 'Password must contain at least 8 characters.');
  assert.equal(validateAccountPassword('New-password1-is-too-long'), 'Password must be 24 characters or fewer.');
  assert.equal(validateAccountPassword('Password!'), 'Password must include at least one number.');
  assert.equal(validateAccountPassword('Password1'), 'Password must include at least one special character.');
  assert.equal(validateAccountPassword('Password1!'), null);
});
