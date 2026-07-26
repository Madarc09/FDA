const NHL_WEB = 'https://api-web.nhle.com/v1';
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;

async function fetchJson(url, timeout = 16000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'FantraxDraftAssist/3.0' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function flattenNumbers(value, prefix = '', output = [], depth = 0) {
  if (output.length >= 80 || depth > 5 || value == null) return output;
  if (typeof value === 'number' && Number.isFinite(value)) {
    output.push({ key: prefix, value });
    return output;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    output.push({ key: prefix, value: Number(value) });
    return output;
  }
  if (Array.isArray(value)) {
    value.slice(0, 12).forEach((item, index) => flattenNumbers(item, `${prefix}${prefix ? '.' : ''}${index}`, output, depth + 1));
    return output;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = `${prefix}${prefix ? '.' : ''}${key}`;
      flattenNumbers(child, next, output, depth + 1);
      if (output.length >= 80) break;
    }
  }
  return output;
}

function usefulMetrics(sections) {
  const preferred = /(max|avg|average|percent|pct|bursts|distance|miles|speed|offensive|neutral|defensive|danger|shots|goals|save)/i;
  const seen = new Set();
  const metrics = [];
  for (const section of sections) {
    for (const metric of flattenNumbers(section.data)) {
      if (!metric.key || !preferred.test(metric.key)) continue;
      const label = metric.key.split('.').filter(part => !/^\d+$/.test(part)).slice(-3).join(' · ');
      const signature = `${section.key}:${label}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      metrics.push({ section: section.label, key: label, value: metric.value });
      if (metrics.length >= 30) return metrics;
    }
  }
  return metrics;
}

export default async function handler(req, res) {
  const playerId = num(req.query?.playerId);
  const season = /^\d{8}$/.test(String(req.query?.season || '')) ? String(req.query.season) : '20252026';
  const position = String(req.query?.position || '').toUpperCase();
  if (!Number.isInteger(playerId) || playerId < 8000000) return res.status(400).json({ error: 'A valid NHL playerId is required.' });

  const definitions = position === 'G'
    ? [{ key: 'goalie', label: 'Goalie tracking', path: `/edge/goalie-detail/${playerId}/${season}/2` }]
    : [
        { key: 'summary', label: 'EDGE overview', path: `/cat/edge/skater-detail/${playerId}/${season}/2` },
        { key: 'skatingSpeed', label: 'Skating speed', path: `/edge/skater-skating-speed-detail/${playerId}/${season}/2` },
        { key: 'skatingDistance', label: 'Skating distance', path: `/edge/skater-skating-distance-detail/${playerId}/${season}/2` },
        { key: 'shotSpeed', label: 'Shot speed', path: `/edge/skater-shot-speed-detail/${playerId}/${season}/2` },
        { key: 'shotLocation', label: 'Shot location', path: `/edge/skater-shot-location-detail/${playerId}/${season}/2` },
        { key: 'zoneTime', label: 'Zone time', path: `/edge/skater-zone-time/${playerId}/${season}/2` }
      ];

  const results = await Promise.allSettled(definitions.map(async definition => ({
    ...definition,
    data: await fetchJson(`${NHL_WEB}${definition.path}`)
  })));
  const sections = [];
  const errors = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') sections.push(result.value);
    else errors.push(`${definitions[index].label}: ${result.reason?.message || 'unavailable'}`);
  });
  if (!sections.length) return res.status(502).json({ error: 'NHL EDGE did not return tracking data for this player and season.', errors });

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({
    playerId,
    season,
    source: 'NHL EDGE',
    generatedAt: new Date().toISOString(),
    metrics: usefulMetrics(sections),
    sections: sections.map(section => ({ key: section.key, label: section.label, data: section.data })),
    errors
  });
}
