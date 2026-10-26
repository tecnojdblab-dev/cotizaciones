const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || '';

let redis = null;
let enabled = false;

if (REDIS_URL && /^rediss?:\/\//.test(REDIS_URL)) {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    lazyConnect: true,
  });

  redis.on('error', () => { });
  redis.on('connect', () => { enabled = true; });
  redis.on('ready', () => { enabled = true; });
  redis.on('end', () => { enabled = false; });

  redis.connect().catch(() => {
    enabled = false;
    redis = null;
  });
}

async function cacheGet(key) {
  if (!enabled || !redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 300) {
  if (!enabled || !redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
  }
}

async function cacheDel(key) {
  if (!enabled || !redis) return;
  try {
    await redis.del(key);
  } catch {
  }
}

async function shutdown() {
  if (redis) {
    try {
      await redis.quit();
    } catch {
    }
    redis = null;
    enabled = false;
  }
}

module.exports = { cacheGet, cacheSet, cacheDel, shutdown, redis };
