const rapidApiKey = process.env.RAPIDAPI_KEY;
const rapidApiHost = (process.env.RAPIDAPI_HOST ?? '').trim();
const rapidApiBaseUrl =
  process.env.RAPIDAPI_BASE_URL?.trim() ||
  (rapidApiHost ? `https://${rapidApiHost}` : 'https://yahoo-finance-real-time1.p.rapidapi.com');

/** Used by resolveTicker (Yahoo-style autocomplete). */
const symbolSearchPath =
  process.env.RAPIDAPI_SYMBOL_SEARCH_PATH?.trim() || '/auto-complete';

/** Curated public search (RapidAPI “GET /search”). */
const publicSearchPath = process.env.RAPIDAPI_PUBLIC_SEARCH_PATH?.trim() || '/search';

/** Legacy paths still used by getMarketContext (quote + legacy news). */
const quotePath = process.env.RAPIDAPI_QUOTE_PATH?.trim() || '/stock/get-detail';
const legacyNewsPath = process.env.RAPIDAPI_LEGACY_NEWS_PATH?.trim() || '/stock/get-news';

const stockSummaryPath = process.env.RAPIDAPI_STOCK_SUMMARY_PATH?.trim() || '/stock/get-summary';
const stockQuoteSummaryPath =
  process.env.RAPIDAPI_STOCK_QUOTE_SUMMARY_PATH?.trim() || '/stock/get-quote-summary';

const newsListPath = process.env.RAPIDAPI_NEWS_LIST_PATH?.trim() || '/news/get-list';
const newsArticlePath = process.env.RAPIDAPI_NEWS_ARTICLE_PATH?.trim() || '/news/get-article';

const marketTrendingPath =
  process.env.RAPIDAPI_MARKET_TRENDING_PATH?.trim() || '/market/get-trending-tickers';
const marketTickerListsPath =
  process.env.RAPIDAPI_MARKET_TICKER_LISTS_PATH?.trim() || '/market/get-ticker-lists';
const marketSummaryPath = process.env.RAPIDAPI_MARKET_SUMMARY_PATH?.trim() || '/market/get-summary';
const marketPopularWatchlistsPath =
  process.env.RAPIDAPI_MARKET_POPULAR_WATCHLISTS_PATH?.trim() || '/market/get-popular-watchlists';
const marketWatchlistPerformancePath =
  process.env.RAPIDAPI_MARKET_WATCHLIST_PERFORMANCE_PATH?.trim() ||
  '/market/get-watchlist-performance';

function requireConfig() {
  if (!rapidApiKey || !rapidApiHost) {
    throw Object.assign(new Error('rapidapi_env_missing'), { statusCode: 500 });
  }
}

export async function callRapidApi(path, queryParams = {}) {
  requireConfig();
  const url = new URL(path, rapidApiBaseUrl.endsWith('/') ? rapidApiBaseUrl : `${rapidApiBaseUrl}/`);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v != null && `${v}`.length > 0) url.searchParams.set(k, `${v}`);
  });
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': rapidApiHost,
    },
  });
  if (!response.ok) {
    throw Object.assign(new Error(`rapidapi_http_${response.status}`), { statusCode: 502 });
  }
  return response.json();
}

export async function fetchQuoteRaw(ticker) {
  return callRapidApi(quotePath, { symbol: ticker });
}

export async function fetchLegacyNewsRaw(ticker) {
  return callRapidApi(legacyNewsPath, { symbol: ticker, region: 'US' });
}

export async function searchSymbolsRaw(query) {
  return callRapidApi(symbolSearchPath, { q: query, region: 'US' });
}

export async function fetchPublicSearchRaw(query) {
  return callRapidApi(publicSearchPath, { q: query });
}

export async function fetchStockSummaryRaw(symbol, extra = {}) {
  return callRapidApi(stockSummaryPath, { symbol, region: 'US', ...extra });
}

export async function fetchStockQuoteSummaryRaw(symbol, extra = {}) {
  return callRapidApi(stockQuoteSummaryPath, { symbol, region: 'US', ...extra });
}

export async function fetchNewsListRaw(params) {
  return callRapidApi(newsListPath, { region: 'US', ...params });
}

export async function fetchNewsArticleRaw(params) {
  return callRapidApi(newsArticlePath, { region: 'US', ...params });
}

export async function fetchMarketTrendingRaw(extra = {}) {
  return callRapidApi(marketTrendingPath, { region: 'US', ...extra });
}

export async function fetchMarketTickerListsRaw(extra = {}) {
  return callRapidApi(marketTickerListsPath, { region: 'US', ...extra });
}

export async function fetchMarketSummaryRaw(extra = {}) {
  return callRapidApi(marketSummaryPath, { region: 'US', ...extra });
}

export async function fetchMarketPopularWatchlistsRaw(extra = {}) {
  return callRapidApi(marketPopularWatchlistsPath, { region: 'US', ...extra });
}

export async function fetchMarketWatchlistPerformanceRaw(extra = {}) {
  return callRapidApi(marketWatchlistPerformancePath, { region: 'US', ...extra });
}

export function normalizeQuote(raw, ticker) {
  const symbol = raw?.symbol ?? raw?.price?.symbol ?? ticker;
  const price =
    raw?.price?.regularMarketPrice?.raw ??
    raw?.regularMarketPrice?.raw ??
    raw?.regularMarketPrice ??
    null;
  const currency = raw?.price?.currency ?? raw?.currency ?? null;
  const asOf = raw?.price?.regularMarketTime?.fmt ?? raw?.regularMarketTime?.fmt ?? null;
  return { symbol, price, currency, asOf, raw };
}

export function normalizeNews(raw, ticker) {
  const list = raw?.data ?? raw?.items ?? raw?.news ?? [];
  const headlines = Array.isArray(list)
    ? list.slice(0, 8).map((item) => ({
        title: item?.title ?? item?.headline ?? null,
        url: item?.link ?? item?.url ?? null,
        publishedAt: item?.pubDate ?? item?.publishedAt ?? item?.providerPublishTime ?? null,
        source: item?.source ?? item?.publisher ?? null,
      }))
    : [];
  return { symbol: ticker, headlines, raw };
}

export function normalizeSearch(raw) {
  const candidates = raw?.quotes ?? raw?.data ?? raw?.items ?? [];
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((c) => ({
      symbol: c?.symbol ?? c?.ticker ?? null,
      name: c?.shortname ?? c?.longname ?? c?.name ?? null,
    }))
    .filter((c) => typeof c.symbol === 'string' && c.symbol.length > 0)
    .slice(0, 5);
}
