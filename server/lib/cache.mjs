const memoryStore = new Map();

const now = () => Date.now();

const getMemory = (key) => {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
};

const setMemory = (key, value, ttlSeconds) => {
  memoryStore.set(key, {
    value,
    expiresAt: now() + ttlSeconds * 1000,
  });
};

let redis = null;
let redisReady = false;

export const initCache = async (redisUrl) => {
  if (!redisUrl) return;

  try {
    const redisModule = await import('redis');
    redis = redisModule.createClient({ url: redisUrl });
    redis.on('error', () => {
      redisReady = false;
    });
    await redis.connect();
    redisReady = true;
  } catch {
    redis = null;
    redisReady = false;
  }
};

export const getCache = async (key) => {
  if (redisReady && redis) {
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  return getMemory(key);
};

export const setCache = async (key, value, ttlSeconds) => {
  if (redisReady && redis) {
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
    return;
  }

  setMemory(key, value, ttlSeconds);
};

export const incrementCounter = async (key, ttlSeconds) => {
  if (redisReady && redis) {
    const next = await redis.incr(key);
    if (next === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return next;
  }

  const current = getMemory(key);
  const next = typeof current === 'number' ? current + 1 : 1;
  setMemory(key, next, ttlSeconds);
  return next;
};

export const cacheHealth = () =>
  redisReady ? 'redis' : 'memory';
