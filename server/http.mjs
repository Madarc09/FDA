const cache = new Map();
const inflight = new Map();
export async function cached(
  key,
  ttl,
  loader,
  { allowStale = false, maxStale = 3600000 } = {},
) {
  const now = Date.now(),
    hit = cache.get(key);
  if (hit && now - hit.savedAt < ttl) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const promise = Promise.resolve().then(async () => {
    try {
      const value = await loader();
      cache.set(key, { value, savedAt: Date.now() });
      if (cache.size > 350) cache.delete(cache.keys().next().value);
      return value;
    } catch (error) {
      if (allowStale && hit && now - hit.savedAt < maxStale)
        return {
          ...hit.value,
          meta: {
            ...hit.value.meta,
            stale: true,
            warning:
              "Source unavailable. Showing the last successful response.",
          },
        };
      throw error;
    } finally {
      inflight.delete(key);
    }
  });
  inflight.set(key, promise);
  return promise;
}
export async function fetchSource(
  url,
  { json = true, timeout = 9000, retries = 1 } = {},
) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: json ? "application/json" : "text/html,text/plain",
          "User-Agent": "TheOriginalSet/1.0 (public hockey information)",
        },
        signal: AbortSignal.timeout(timeout),
      });
      if (!r.ok) {
        const e = new Error(`Source returned HTTP ${r.status}`);
        e.status = r.status;
        throw e;
      }
      return json ? r.json() : r.text();
    } catch (e) {
      last = e;
      if (e.status && e.status < 500 && e.status !== 429) break;
    }
  }
  throw last;
}
export function envelope(data, source, extra = {}) {
  return {
    data,
    meta: {
      source,
      fetchedAt: new Date().toISOString(),
      stale: false,
      ...extra,
    },
  };
}
export function resetCaches() {
  cache.clear();
  inflight.clear();
}
