const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getAllowedOrigins,
  createCorsOptions,
  getJwtSecret,
  getMongoUri,
  isOriginAllowed,
  shouldUseLocalDatabaseFallback,
} = require('../config/runtime');

test('development runtime configuration keeps safe local defaults', () => {
  const env = { NODE_ENV: 'development' };

  assert.equal(getJwtSecret(env), 'taskedge-development-secret');
  assert.equal(getMongoUri(env), 'mongodb://127.0.0.1:27017/project');
  assert.deepEqual(getAllowedOrigins(env), [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ]);
  assert.equal(shouldUseLocalDatabaseFallback(env), true);
})

test('production requires explicit JWT MongoDB and client-origin configuration', () => {
  assert.throws(() => getJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(() => getMongoUri({ NODE_ENV: 'production' }), /MONGO_URI/);
  assert.throws(() => getAllowedOrigins({ NODE_ENV: 'production' }), /CLIENT_ORIGINS/);
  assert.equal(shouldUseLocalDatabaseFallback({ NODE_ENV: 'production' }), false);
})

test('production origins are parsed trimmed and matched exactly', () => {
  const origins = getAllowedOrigins({
    NODE_ENV: 'production',
    CLIENT_ORIGINS: ' https://taskedge.vercel.app,https://admin.taskedge.app/ ',
  });

  assert.deepEqual(origins, ['https://taskedge.vercel.app', 'https://admin.taskedge.app']);
  assert.equal(isOriginAllowed(undefined, origins), true);
  assert.equal(isOriginAllowed('https://taskedge.vercel.app', origins), true);
  assert.equal(isOriginAllowed('https://evil.example', origins), false);
})

test('development CORS permits Flutter Web loopback origins on dynamic ports only', async () => {
  const check = (origin, env) => new Promise((resolve) => {
    createCorsOptions(['http://localhost:5173'], env).origin(origin, (error, allowed) => {
      resolve({ error, allowed });
    });
  });

  assert.deepEqual(await check('http://localhost:58396', { NODE_ENV: 'development' }), { error: null, allowed: true });
  assert.deepEqual(await check('http://127.0.0.1:58396', { NODE_ENV: 'development' }), { error: null, allowed: true });
  assert.equal((await check('https://localhost:58396', { NODE_ENV: 'development' })).allowed, undefined);
  assert.equal((await check('http://localhost:58396', { NODE_ENV: 'production' })).allowed, undefined);
});
