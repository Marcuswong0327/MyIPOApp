import { Router } from 'express';
import OpenAI from 'openai';
import { getPool } from '../db.js';
import { getMarketContext } from '../news/getMarketContext.js';

export const reportsRouter = Router();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMBED_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
const PROMPT_VERSION = 'auditor-v1';
const CANDIDATE_K = 50;
const FINAL_K = 15;
const MIN_CHUNK_INDEX_GAP = 3;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function vectorLiteral(values) {
  return `[${values.map((v) => Number(v).toString()).join(',')}]`;
}

function selectDiverseChunks(candidates) {
  const selected = [];
  for (const candidate of candidates) {
    const isNearExisting = selected.some(
      (picked) => Math.abs(picked.chunk_index - candidate.chunk_index) < MIN_CHUNK_INDEX_GAP,
    );
    if (!isNearExisting) selected.push(candidate);
    if (selected.length >= FINAL_K) break;
  }

  if (selected.length < FINAL_K) {
    for (const candidate of candidates) {
      if (!selected.find((picked) => picked.id === candidate.id)) {
        selected.push(candidate);
      }
      if (selected.length >= FINAL_K) break;
    }
  }
  return selected;
}

/**
 * POST body: { ipoId: uuid, userQuestion?: string }
 * Auditor v1: query embedding -> retrieve top chunks -> generate synthesis draft.
 */
reportsRouter.post('/', async (req, res, next) => {
  try {
    const { ipoId, userQuestion } = req.body ?? {};
    if (typeof ipoId !== 'string') {
      res.status(400).json({ error: 'ipoId_required' });
      return;
    }
    if (!UUID_RE.test(ipoId)) {
      res.status(400).json({ error: 'ipoId_invalid_uuid' });
      return;
    }
    if (userQuestion != null && typeof userQuestion !== 'string') {
      res.status(400).json({ error: 'userQuestion_must_be_string' });
      return;
    }
    if (!openai) {
      res.status(500).json({ error: 'openai_api_key_missing' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `select id, status, ticker, name from public.ipos where id = $1::uuid limit 1`,
      [ipoId],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'ipo_not_found' });
      return;
    }
    if (rows[0].status !== 'published') {
      res.status(409).json({ error: 'ipo_not_published' });
      return;
    }
    const ipo = rows[0];
    const question =
      userQuestion?.trim() ||
      `Audit ${ipo.ticker} IPO prospectus and summarize key risks, strengths, and watch-outs for retail investors.`;

    const embeddingResponse = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: question,
    });
    const queryVector = vectorLiteral(embeddingResponse.data[0].embedding);

    const candidatesResult = await pool.query(
      `
      select id, chunk_index, content, metadata,
             (embedding <=> $2::extensions.vector) as distance
      from public.prospectus_chunks
      where ipo_id = $1::uuid
        and embedding is not null
      order by embedding <=> $2::extensions.vector
      limit ${CANDIDATE_K}
      `,
      [ipoId, queryVector],
    );
    if (candidatesResult.rows.length === 0) {
      res.status(409).json({ error: 'ipo_not_indexed' });
      return;
    }

    const selectedChunks = selectDiverseChunks(candidatesResult.rows);

    const context = selectedChunks
      .map(
        (c) =>
          `Chunk #${c.chunk_index} (id=${c.id}, distance=${Number(c.distance).toFixed(4)}):\n${c.content}`,
      )
      .join('\n\n');

    let marketContext = null;
    let marketContextError = null;
    try {
      marketContext = await getMarketContext(ipo.ticker);
    } catch (error) {
      marketContextError = error.message ?? 'market_context_unavailable';
    }

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are the Auditor Agent for IPO prospectus analysis. Use only provided context. If context is insufficient, say so explicitly. Provide concise, factual output with clear bullet points.',
        },
        {
          role: 'user',
          content: [
            `IPO: ${ipo.ticker} - ${ipo.name}`,
            `Question: ${question}`,
            'Context chunks:',
            context,
            'Market context (if available):',
            marketContext ? JSON.stringify(marketContext) : `Unavailable: ${marketContextError ?? 'n/a'}`,
            'Output JSON with keys: executive_summary (string), key_risks (array of strings), key_strengths (array of strings), unknowns (array of strings), confidence (number 0-1), and markdown_report (string).',
          ].join('\n\n'),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        executive_summary: 'Model returned non-JSON output.',
        key_risks: [],
        key_strengths: [],
        unknowns: ['Model output parsing failed'],
        confidence: 0.0,
        markdown_report: raw,
      };
    }

    const citations = selectedChunks.map((c) => ({
      chunk_id: c.id,
      chunk_index: c.chunk_index,
      distance: Number(c.distance),
    }));

    const retrievalDebug = {
      candidate_count: candidatesResult.rows.length,
      selected_count: selectedChunks.length,
      selected_chunk_indexes: selectedChunks.map((c) => c.chunk_index),
      top_candidate_indexes: candidatesResult.rows.slice(0, 10).map((c) => c.chunk_index),
    };

    const jsonPayload = {
      ...parsed,
      question,
      ipo: { id: ipo.id, ticker: ipo.ticker, name: ipo.name },
      citations,
      market_context: marketContext,
      market_context_error: marketContextError,
      retrieval_debug: retrievalDebug,
      pipeline_stage: 'auditor_v1',
    };
    const markdownReport =
      typeof parsed.markdown_report === 'string' && parsed.markdown_report.trim().length > 0
        ? parsed.markdown_report
        : `## Auditor Summary\n\n${parsed.executive_summary ?? 'No summary generated.'}`;

    const insert = await pool.query(
      `
      insert into public.reports (user_id, ipo_id, json_payload, markdown_report, model, prompt_version)
      values ($1::uuid, $2::uuid, $3::jsonb, $4::text, $5::text, $6::text)
      returning id, created_at
      `,
      [req.userId, ipoId, JSON.stringify(jsonPayload), markdownReport, CHAT_MODEL, PROMPT_VERSION],
    );

    res.status(201).json({
      reportId: insert.rows[0].id,
      createdAt: insert.rows[0].created_at,
      ipoId,
      userId: req.userId,
      model: CHAT_MODEL,
      stage: 'auditor_v1',
      summary: jsonPayload.executive_summary ?? null,
      citations,
      market_context_status: marketContext ? 'available' : 'unavailable',
      retrieval_debug: retrievalDebug,
      markdown_report: markdownReport,
    });
  } catch (e) {
    next(e);
  }
});
