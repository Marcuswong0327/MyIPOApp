/**
 * Stable cache key from route name + params object (sorted keys).
 */
export function stableCacheKey(routeName, params) {
  const entries = Object.entries(params)
    .filter(([, v]) => v != null && `${v}`.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  return `${routeName}:${entries.join('&')}`;
}
