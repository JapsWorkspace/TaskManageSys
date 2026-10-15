const assert = require('node:assert/strict');
const test = require('node:test');

const { resolveMongoUri } = require('./set-user-role');

test('resolveMongoUri prefers the server MONGO_URI over local fallback', () => {
  assert.equal(
    resolveMongoUri({
      MONGO_URI: 'mongodb+srv://example/project',
      LOCAL_MONGO_URI: 'mongodb://127.0.0.1:27017/local-project',
    }),
    'mongodb+srv://example/project',
  );
});

test('resolveMongoUri falls back to local development database', () => {
  assert.equal(
    resolveMongoUri({}),
    'mongodb://127.0.0.1:27017/project',
  );
});
