import { Router } from 'express';
import { cacheAside } from '../cache/cacheAside.js';
import { stableCacheKey } from '../cache/cacheKey.js';
import { fetchNewsArticleRaw, fetchNewsListRaw } from '../news/rapidapi.js';
import { getMarketContext } from '../news/getMarketContext.js';

export const newsRouter = Router();

const SYMBOL_RE = /^[A-Za-z0-9.\-]{1,20}$/;

function listTtl() {
  return Number(process.env.CACHE_TTL_NEWS_LIST_SEC ?? 10800);
}

function articleTtl() {
  return Number(process.env.CACHE_TTL_NEWS_ARTICLE_SEC ?? 3600);
}

newsRouter.get('/list', async (req, res, next) => {
  try {
    const symbol = (req.query.symbol ?? '').trim().toUpperCase();
    if (!SYMBOL_RE.test(symbol)) {
      res.status(400).json({ error: 'symbol_required_or_invalid' });
      return;
    }
    const extra = { ...req.query, symbol };
    delete extra._;
    const key = stableCacheKey('v1:news:list', extra);
    const { value, cache_hit } = await cacheAside(key, listTtl(), () => fetchNewsListRaw(extra));
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: listTtl() },
      symbol,
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

newsRouter.get('/article', async (req, res, next) => {
  try {
    const id = (req.query.id ?? req.query.uuid ?? '').trim();
    if (!id) {
      res.status(400).json({ error: 'id_required' });
      return;
    }
    const extra = { ...req.query };
    delete extra._;
    const key = stableCacheKey('v1:news:article', extra);
    const { value, cache_hit } = await cacheAside(key, articleTtl(), () => fetchNewsArticleRaw(extra));
    res.status(200).json({
      source: 'rapidapi',
      cache: { hit: cache_hit, ttl_seconds: articleTtl() },
      data: value,
    });
  } catch (e) {
    next(e);
  }
});

newsRouter.get('/context/:query', async (req, res, next) => {
  try {
    const query = req.params.query?.trim() ?? '';
    if (!query) {
      res.status(400).json({ error: 'query_required' });
      return;
    }

    const result = await getMarketContext(query);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'needs_clarification') {
      res.status(409).json({
        error: 'needs_clarification',
        suggestions: error.suggestions ?? [],
      });
      return;
    }
    next(error);
  }
});
