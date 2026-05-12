import { getJson, setJson } from '../cache/upstash.js';
import { fetchNewsRaw, fetchQuoteRaw, normalizeNews, normalizeQuote } from './rapidapi.js';
import { resolveTicker } from './resolveTicker.js';

const QUOTE_TTL_SECONDS = 600;
const NEWS_TTL_SECONDS = 10800;

export async function getMarketContext(query) {
  const { resolvedTicker, resolution, suggestions } = await resolveTicker(query);

  const quoteKey = `quote:${resolvedTicker}`;
  const newsKey = `news:${resolvedTicker}`;
  const quoteCached = await getJson(quoteKey);
  const newsCached = await getJson(newsKey);

  let quote = quoteCached;
  let news = newsCached;
  let quoteCacheHit = Boolean(quoteCached);
  let newsCacheHit = Boolean(newsCached);

  if (!quote) {
    const quoteRaw = await fetchQuoteRaw(resolvedTicker);
    quote = normalizeQuote(quoteRaw, resolvedTicker);
    await setJson(quoteKey, quote, QUOTE_TTL_SECONDS);
    quoteCacheHit = false;
  }

  if (!news) {
    const newsRaw = await fetchNewsRaw(resolvedTicker);
    news = normalizeNews(newsRaw, resolvedTicker);
    await setJson(newsKey, news, NEWS_TTL_SECONDS);
    newsCacheHit = false;
  }

  return {
    input: query,
    resolved_ticker: resolvedTicker,
    resolution,
    suggestions,
    cache: {
      quote_ttl_seconds: QUOTE_TTL_SECONDS,
      news_ttl_seconds: NEWS_TTL_SECONDS,
      quote_hit: quoteCacheHit,
      news_hit: newsCacheHit,
    },
    quote,
    news,
  };
}

