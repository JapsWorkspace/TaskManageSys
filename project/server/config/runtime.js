const DEVELOPMENT_JWT_SECRET = 'taskedge-development-secret';
const DEVELOPMENT_MONGO_URI = 'mongodb://127.0.0.1:27017/project';
const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

const isProduction = (env) => env.NODE_ENV === 'production';
const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const getJwtSecret = (env = process.env) => {
  const secret = String(env.JWT_SECRET || '').trim();
  if (isProduction(env) && (!secret || secret === DEVELOPMENT_JWT_SECRET)) {
    throw new Error('JWT_SECRET must be configured with a strong production value.');
  }
  return secret || DEVELOPMENT_JWT_SECRET;
};

const getMongoUri = (env = process.env) => {
  const uri = String(env.MONGO_URI || env.LOCAL_MONGO_URI || '').trim();
  if (isProduction(env) && !env.MONGO_URI) {
    throw new Error('MONGO_URI must be configured in production.');
  }
  return uri || DEVELOPMENT_MONGO_URI;
};

const getAllowedOrigins = (env = process.env) => {
  const origins = String(env.CLIENT_ORIGINS || '')
    .split(',')
    .map(trimTrailingSlash)
    .filter(Boolean);

  if (isProduction(env) && origins.length === 0) {
    throw new Error('CLIENT_ORIGINS must be configured in production.');
  }
  return origins.length ? origins : DEVELOPMENT_ORIGINS;
};

const isOriginAllowed = (origin, allowedOrigins) => (
  !origin || allowedOrigins.includes(trimTrailingSlash(origin))
);

const isDevelopmentLocalOrigin = (origin, env = process.env) => {
  if (!origin || isProduction(env)) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
  } catch (_) {
    return false;
  }
};

const shouldUseLocalDatabaseFallback = (env = process.env) => !isProduction(env);

const createCorsOptions = (allowedOrigins, env = process.env) => ({
  origin(origin, callback) {
    if (isOriginAllowed(origin, allowedOrigins) || isDevelopmentLocalOrigin(origin, env)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS.'));
  },
});

module.exports = {
  createCorsOptions,
  getAllowedOrigins,
  getJwtSecret,
  getMongoUri,
  isDevelopmentLocalOrigin,
  isOriginAllowed,
  shouldUseLocalDatabaseFallback,
};
