import { Router } from 'express';
import { getPool } from '../db.js';

export const reportsRouter = Router();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST body: { ipoId: uuid, userQuestion?: string }
 * Sequential Auditor → News → Synthesis will live here; stub returns 501 until wired.
 */
reportsRouter.post('/', async (req, res, next) => {
  try {
    const { ipoId } = req.body ?? {};
    if (typeof ipoId !== 'string') {
      res.status(400).json({ error: 'ipoId_required' });
      return;
    }
    if (!UUID_RE.test(ipoId)) {
      res.status(400).json({ error: 'ipoId_invalid_uuid' });
      return;
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `select id, status from public.ipos where id = $1::uuid limit 1`,
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

    res.status(501).json({
      error: 'not_implemented',
      detail: 'Auditor → Market news → Synthesis pipeline not wired yet.',
      userId: req.userId,
      ipoId,
    });
  } catch (e) {
    next(e);
  }
});
