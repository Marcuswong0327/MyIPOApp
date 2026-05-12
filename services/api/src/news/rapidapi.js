const rapidApiKey = process.env.RAPIDAPI_KEY;
const rapidApiHost = process.env.RAPIDAPI_HOST;
const rapidApiBaseUrl =
  process.env.RAPIDAPI_BASE_URL ?? `https://${rapidApiHost ?? 'yahoo-finance-real-time1.p.rapidapi.com'}`;
const quotePath = process.env.RAPIDAPI_QUOTE_PATH ?? '/stock/get-detail';
const newsPath = process.env.RAPIDAPI_NEWS_PATH ?? '/stock/get-news';
const searchPath = process.env.RAPIDAPI_SEARCH_PATH ?? '/auto-complete';

function requireConfig() {
  if (!rapidApiKey || !rapidApiHost) {
    throw Object.assign(new Error('rapidapi_env_missing'), { statusCode: 500 });
  }
}

async function callRapidApi(path, queryParams) {
  requireConfig();
  const url = new URL(path, rapidApiBaseUrl);
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

export async function fetchNewsRaw(ticker) {
  return callRapidApi(newsPath, { symbol: ticker, region: 'US' });
}

export async function searchSymbolsRaw(query) {
  return callRapidApi(searchPath, { q: query, region: 'US' });
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

