import 'dotenv/config';
import express from 'express';
import { authMiddleware } from './auth.js';
import { newsRouter } from './routes/news.js';
import { reportsRouter } from './routes/reports.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/v1/reports', authMiddleware, reportsRouter);
app.use('/v1/news', authMiddleware, newsRouter);

app.use((err, _req, res, _next) => {
  const status = err.statusCode ?? 500;
  const message = status === 500 ? 'internal_error' : err.message;
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
