import { getJson, setJson } from './upstash.js';

/**
 * Cache-aside: try Redis; on miss run fetcher and store (fail-open if Redis errors).
 * Returns { value, cache_hit }.
 */
export async function cacheAside(key, ttlSeconds, fetcher) {
  const cached = await getJson(key);
  if (cached != null) {
    return { value: cached, cache_hit: true };
  }
  const value = await fetcher();
  await setJson(key, value, ttlSeconds);
  return { value, cache_hit: false };
}
