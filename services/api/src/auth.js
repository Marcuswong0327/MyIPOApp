import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

const supabaseUrl = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const legacySecret = process.env.SUPABASE_JWT_SECRET;

const jwksClient =
  supabaseUrl.length > 0
    ? jwksRsa({
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
      })
    : null;

function getJwksKey(header, callback) {
  if (!header?.kid) {
    callback(new Error('missing_kid'));
    return;
  }
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, key.getPublicKey());
  });
}

function verifyLegacyHs256(token) {
  if (!legacySecret) return null;
  try {
    return jwt.verify(token, legacySecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * Verifies Supabase-issued JWT.
 * Interface: sets req.userId (sub) on success;
 * error modes: 401 missing/invalid/expired token; 500 missing server config.
 *
 * Supports current Supabase JWT signing (JWKS: ES256 / RS256) and optional
 * Legacy HS256 (SUPABASE_JWT_SECRET) while old tokens still expire.
 */
export function authMiddleware(req, res, next) {
  if (!jwksClient && !legacySecret) {
    res.status(500).json({ error: 'server_misconfigured' });
    return;
  }

  const header = req.headers.authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: 'missing_bearer_token' });
    return;
  }

  const token = match[1];

  const finish = (payload) => {
    const sub = payload.sub;
    if (typeof sub !== 'string' || !sub) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    req.userId = sub;
    next();
  };

  if (!jwksClient) {
    const payload = verifyLegacyHs256(token);
    if (!payload) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    finish(payload);
    return;
  }

  const issuer = `${supabaseUrl}/auth/v1`;

  jwt.verify(
    token,
    getJwksKey,
    {
      algorithms: ['ES256', 'RS256'],
      issuer,
    },
    (err, payload) => {
      if (!err && payload) {
        finish(payload);
        return;
      }
      const legacy = verifyLegacyHs256(token);
      if (legacy) {
        finish(legacy);
        return;
      }
      res.status(401).json({ error: 'invalid_token' });
    },
  );
}
