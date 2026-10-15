const assert = require('node:assert/strict');
const test = require('node:test');

const { signAuthToken, verifyAuthToken } = require('./token');

test('signAuthToken creates a token that verifies to the user id', () => {
    process.env.JWT_SECRET = 'test-secret';

    const token = signAuthToken('user-123');
    const payload = verifyAuthToken(token);

    assert.equal(payload.id, 'user-123');
});

test('signAuthToken includes the token version for global logout', () => {
    process.env.JWT_SECRET = 'test-secret';

    const token = signAuthToken('user-123', 3);
    const payload = verifyAuthToken(token);

    assert.equal(payload.id, 'user-123');
    assert.equal(payload.tokenVersion, 3);
});

test('verifyAuthToken rejects invalid tokens', () => {
    process.env.JWT_SECRET = 'test-secret';

    assert.throws(() => verifyAuthToken('bad-token'));
});

test('production token signing refuses a missing JWT secret', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSecret = process.env.JWT_SECRET;

    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    try {
        assert.throws(() => signAuthToken('user-123'), /JWT_SECRET/);
    } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnv;
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    }
});
