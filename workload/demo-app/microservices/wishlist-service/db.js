import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: Number(process.env.REDIS_PORT) || 6379,
});

redis.on('connect', () => console.log('Connected to Redis (wishlist)'));
redis.on('error', (err) => console.error('Redis wishlist error:', err));

export default redis;