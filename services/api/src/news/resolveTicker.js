import aliases from './ticker-aliases.json' with { type: 'json' };
import { normalizeSearch, searchSymbolsRaw } from './rapidapi.js';

function normalizeInput(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function sanitizeTicker(value) {
  return value.trim().toUpperCase();
}

export async function resolveTicker(input) {
  const query = normalizeInput(input);
  if (!query) {
    throw Object.assign(new Error('query_required'), { statusCode: 400 });
  }

  const direct = sanitizeTicker(query);
  if (/^[A-Z.\-]{1,12}$/.test(direct)) {
    return {
      resolvedTicker: direct,
      resolution: { input, resolved_ticker: direct, confidence: 0.98, match_source: 'direct' },
      suggestions: [],
    };
  }

  const aliasHit = aliases[query.toLowerCase()];
  if (aliasHit) {
    return {
      resolvedTicker: aliasHit,
      resolution: {
        input,
        resolved_ticker: aliasHit,
        confidence: 0.95,
        match_source: 'alias',
      },
      suggestions: [],
    };
  }

  const raw = await searchSymbolsRaw(query);
  const candidates = normalizeSearch(raw);
  if (candidates.length === 0) {
    throw Object.assign(new Error('ticker_not_found'), { statusCode: 404 });
  }

  const top = candidates[0];
  const highConfidence = top.name?.toLowerCase().includes(query.toLowerCase()) ?? false;
  if (highConfidence || candidates.length === 1) {
    return {
      resolvedTicker: sanitizeTicker(top.symbol),
      resolution: {
        input,
        resolved_ticker: sanitizeTicker(top.symbol),
        confidence: highConfidence ? 0.9 : 0.75,
        match_source: 'rapidapi_search',
      },
      suggestions: candidates,
    };
  }

  const err = Object.assign(new Error('needs_clarification'), { statusCode: 409 });
  err.suggestions = candidates;
  throw err;
}

