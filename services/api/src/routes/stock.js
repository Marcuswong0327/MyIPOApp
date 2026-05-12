import { Router } from 'express';
import { cacheAside } from '../cache/cacheAside.js';
import { stableCacheKey } from '../cache/cacheKey.js';
import { fetchStockQuoteSummaryRaw, fetchStockSummaryRaw } from '../news/rapidapi.js';

export const stockRouter = Router();

const SYMBOL_RE = /^[A-Za-z0-9.\-]{1,20}$/;

function summaryTtl() {
  return Number(process.env.CACHE_TTL_STOCK_SUMMARY_SEC ?? 600);
}

function quoteSummaryTtl() {
  return Number(process.env.CACHE_TTL_STOCK_QUOTE_SUMMARY_SEC ?? 300);
}

function validateSymbol(symbol) {
  const s = symbol?.trim() ?? '';
  if (!SYMBOL_RE.test(s)) {
    const err = new Error('invalid_symbol');
    err.statusCode = 400;
    throw err;
  }
  return s.toUpperCase();
}

stockRouter.get('/:symbol/summary', async (req, res, next) => {
  try {
    const symbol = validateSymbol(req.params.symbol);
    const extra = { ...req.query };
    delete extra._; // common cache-buster
    const key = stableCacheKey('v1:stock:summary', { symbol, ...extra });
    const { value, cache_hit } = await cacheAside(key, summaryTtl(), () =>
      fetchStockSummaryRaw(symbol, extra),
    );
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: summaryTtl() },
      symbol,
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

stockRouter.get('/:symbol/quote-summary', async (req, res, next) => {
  try {
    const symbol = validateSymbol(req.params.symbol);
    const extra = { ...req.query };
    delete extra._;
    const key = stableCacheKey('v1:stock:quote-summary', { symbol, ...extra });
    const { value, cache_hit } = await cacheAside(key, quoteSummaryTtl(), () =>
      fetchStockQuoteSummaryRaw(symbol, extra),
    );
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: quoteSummaryTtl() },
      symbol,
      data: value,
    });
  } catch (e) {
    next(e);
  }
});
