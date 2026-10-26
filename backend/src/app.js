const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redis } = require('./services/cache/redisClient');

const { router } = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { env } = require('./config/env');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
  ...(redis && {
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rate-limit:api:',
    }),
  }),
});

const createAuthLimiter = (prefix) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos de inicio de sesión, intenta de nuevo más tarde' },
  ...(redis && {
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix,
    }),
  }),
});

const authLimiter = createAuthLimiter('rate-limit:login:');
const bootstrapLimiter = createAuthLimiter('rate-limit:bootstrap-admin:');

if (process.env.NODE_ENV === 'production' && !redis) {
  console.warn('REDIS_URL no está configurada; los límites de solicitudes no se compartirán entre instancias serverless.');
}

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(morgan('short'));

  app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

  app.use(cors({
    origin: env.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Retry-After', 'RateLimit', 'RateLimit-Policy'],
  }));

  app.use(express.json({ limit: '2mb' }));

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/bootstrap-admin', bootstrapLimiter);
  app.use('/api', limiter);

  app.use(router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
