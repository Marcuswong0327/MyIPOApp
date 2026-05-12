import { Router } from 'express';
import { getMarketContext } from '../news/getMarketContext.js';

export const newsRouter = Router();

newsRouter.get('/:query', async (req, res, next) => {
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

