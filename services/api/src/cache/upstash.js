const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function hasConfig() {
  return Boolean(redisUrl && redisToken);
}

async function callRedis(path) {
  const response = await fetch(`${redisUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`redis_http_${response.status}`);
  }
  return response.json();
}

export async function getJson(key) {
  if (!hasConfig()) return null;
  try {
    const payload = await callRedis(`/get/${encodeURIComponent(key)}`);
    if (!payload?.result) return null;
    return JSON.parse(payload.result);
  } catch {
    return null;
  }
}

export async function setJson(key, value, ttlSeconds) {
  if (!hasConfig()) return false;
  try {
    await callRedis(
      `/setex/${encodeURIComponent(key)}/${ttlSeconds}/${encodeURIComponent(JSON.stringify(value))}`,
    );
    return true;
  } catch {
    return false;
  }
}

