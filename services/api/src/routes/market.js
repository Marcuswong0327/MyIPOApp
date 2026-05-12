import { Router } from 'express';
import { cacheAside } from '../cache/cacheAside.js';
import { stableCacheKey } from '../cache/cacheKey.js';
import {
  fetchMarketPopularWatchlistsRaw,
  fetchMarketSummaryRaw,
  fetchMarketTickerListsRaw,
  fetchMarketTrendingRaw,
  fetchMarketWatchlistPerformanceRaw,
} from '../news/rapidapi.js';

export const marketRouter = Router();

function qParams(req) {
  const extra = { ...req.query };
  delete extra._;
  return extra;
}

function trendingTtl() {
  return Number(process.env.CACHE_TTL_MARKET_TRENDING_SEC ?? 120);
}
function tickerListsTtl() {
  return Number(process.env.CACHE_TTL_MARKET_TICKER_LISTS_SEC ?? 3600);
}
function summaryTtl() {
  return Number(process.env.CACHE_TTL_MARKET_SUMMARY_SEC ?? 300);
}
function popularTtl() {
  return Number(process.env.CACHE_TTL_MARKET_POPULAR_WATCHLISTS_SEC ?? 3600);
}
function perfTtl() {
  return Number(process.env.CACHE_TTL_MARKET_WATCHLIST_PERF_SEC ?? 600);
}

marketRouter.get('/trending', async (req, res, next) => {
  try {
    const extra = qParams(req);
    const key = stableCacheKey('v1:market:trending', extra);
    const { value, cache_hit } = await cacheAside(key, trendingTtl(), () => fetchMarketTrendingRaw(extra));
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: trendingTtl() },
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

marketRouter.get('/ticker-lists', async (req, res, next) => {
  try {
    const extra = qParams(req);
    const key = stableCacheKey('v1:market:ticker-lists', extra);
    const { value, cache_hit } = await cacheAside(key, tickerListsTtl(), () => fetchMarketTickerListsRaw(extra));
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: tickerListsTtl() },
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

marketRouter.get('/summary', async (req, res, next) => {
  try {
    const extra = qParams(req);
    const key = stableCacheKey('v1:market:summary', extra);
    const { value, cache_hit } = await cacheAside(key, summaryTtl(), () => fetchMarketSummaryRaw(extra));
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: summaryTtl() },
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

marketRouter.get('/popular-watchlists', async (req, res, next) => {
  try {
    const extra = qParams(req);
    const key = stableCacheKey('v1:market:popular-watchlists', extra);
    const { value, cache_hit } = await cacheAside(key, popularTtl(), () =>
      fetchMarketPopularWatchlistsRaw(extra),
    );
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: popularTtl() },
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

marketRouter.get('/watchlist-performance', async (req, res, next) => {
  try {
    const extra = qParams(req);
    const key = stableCacheKey('v1:market:watchlist-performance', extra);
    const { value, cache_hit } = await cacheAside(key, perfTtl(), () =>
      fetchMarketWatchlistPerformanceRaw(extra),
    );
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: perfTtl() },
      data: value,
    });
  } catch (e) {
    next(e);
  }
});
