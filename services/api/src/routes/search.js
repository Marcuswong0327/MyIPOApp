import { Router } from 'express';
import { cacheAside } from '../cache/cacheAside.js';
import { stableCacheKey } from '../cache/cacheKey.js';
import { fetchPublicSearchRaw } from '../news/rapidapi.js';

export const searchRouter = Router();

const ttl = () => Number(process.env.CACHE_TTL_SEARCH_SEC ?? 300);

searchRouter.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'q_required' });
      return;
    }
    const key = stableCacheKey('v1:search', { q });
    const { value, cache_hit } = await cacheAside(key, ttl(), () => fetchPublicSearchRaw(q));
    res.status(200).json({ source: 'rapidapi', cache: { hit: cache_hit, ttl_seconds: ttl() }, data: value });
  } catch (e) {
    next(e);
  }
});
