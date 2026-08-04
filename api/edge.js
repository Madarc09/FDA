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


function localText(value) {
  return value?.default || value?.en || value?.fr || value || '';
}

function measurementValue(value) {
  if (value == null) return null;
  if (Number.isFinite(Number(value))) return Number(value);
  for (const key of ['imperial','value','mph','miles','percentage','pctg','savePctg','zoneTime','distanceSkated','skatingSpeed','shotSpeed','sog']) {
    if (value?.[key] != null && Number.isFinite(Number(value[key]))) return Number(value[key]);
  }
  return null;
}

function leaderboardRows(payload, metric) {
  const arrays = [];
  const walk = (value, depth = 0) => {
    if (depth > 5 || value == null) return;
    if (Array.isArray(value)) {
      if (value.some(item => item && typeof item === 'object' && (item.player || item.playerId || item.id))) arrays.push(value);
      value.slice(0,20).forEach(item => walk(item, depth + 1));
      return;
    }
    if (typeof value === 'object') Object.values(value).forEach(child => walk(child, depth + 1));
  };
  walk(payload);
  const candidates = arrays.sort((a,b)=>b.length-a.length)[0] || [];
  const keys = {
    maxSkatingSpeed:['skatingSpeed','speed','maxSkatingSpeed'],
    hardestShot:['shotSpeed','speed','topShotSpeed'],
    totalDistanceSkated:['distanceSkated','distance','totalDistanceSkated'],
    offensiveZoneTime:['zoneTime','offensiveZoneTime','percentage'],
    defensiveZoneTime:['zoneTime','defensiveZoneTime','percentage']
  }[metric] || [];
  return candidates.map((row,index) => {
    const player = row.player || row.skater || row.goalie || row;
    let value = null;
    for (const key of keys) {
      value = measurementValue(row[key] ?? player[key]);
      if (value != null) break;
    }
    if (value == null) {
      const numbers = flattenNumbers(row).filter(item => !/(id|season|game|rank|number)/i.test(item.key));
      value = numbers[0]?.value ?? null;
    }
    const id = num(player.playerId ?? player.id ?? row.playerId ?? row.id);
    const first = localText(player.firstName);
    const last = localText(player.lastName);
    return {
      rank:index+1,
      id,
      name:`${first} ${last}`.trim() || localText(player.fullName) || player.name || `Player ${id}`,
      team:player.teamAbbrev || player.team || player.currentTeamAbbrev || '',
      position:player.position || player.positionCode || '',
      headshot:player.headshot || (id ? `https://assets.nhle.com/mugs/nhl/latest/${id}.png` : ''),
      value
    };
  }).filter(row=>row.id).slice(0,10);
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
  const leaderboard = String(req.query?.leaderboard || '');
  if (leaderboard) {
    const group = position === 'D' ? 'D' : 'F';
    const paths = {
      maxSkatingSpeed:`/edge/skater-speed-top-10/${group}/max/${season}/2`,
      hardestShot:`/edge/skater-shot-speed-top-10/${group}/max/${season}/2`,
      totalDistanceSkated:`/edge/skater-distance-top-10/${group}/all/total/${season}/2`,
      offensiveZoneTime:`/edge/skater-zone-time-top-10/${group}/all/offensive/${season}/2`,
      defensiveZoneTime:`/edge/skater-zone-time-top-10/${group}/all/defensive/${season}/2`
    };
    if (!paths[leaderboard]) return res.status(400).json({ error:'That EDGE leaderboard is not supported.' });
    try {
      const data = await fetchJson(`${NHL_WEB}${paths[leaderboard]}`);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ source:'NHL EDGE top 10', season, metric:leaderboard, rows:leaderboardRows(data,leaderboard), raw:data });
    } catch (error) {
      return res.status(502).json({ error:error?.message || 'NHL EDGE leaderboard unavailable.' });
    }
  }
  if (!Number.isInteger(playerId) || playerId < 8000000) return res.status(400).json({ error: 'A valid NHL playerId is required.' });

  const definitions = position === 'G'
    ? [
        { key: 'goalie', label: 'Goalie performance', path: `/edge/goalie-detail/${playerId}/${season}/2` },
        { key: 'savePct', label: 'Save percentage', path: `/edge/goalie-save-percentage-detail/${playerId}/${season}/2` },
        { key: 'fiveOnFive', label: 'Five-on-five save percentage', path: `/edge/goalie-5v5-detail/${playerId}/${season}/2` },
        { key: 'shotLocation', label: 'Shot location', path: `/edge/goalie-shot-location-detail/${playerId}/${season}/2` },
        { key: 'landing', label: 'Goalie league leaders', path: `/edge/goalie-landing/${season}/2` }
      ]
    : [
        { key: 'summary', label: 'EDGE overview', path: `/cat/edge/skater-detail/${playerId}/${season}/2` },
        { key: 'comparison', label: 'EDGE comparison', path: `/edge/skater-comparison/${playerId}/${season}/2` },
        { key: 'skatingSpeed', label: 'Skating speed', path: `/edge/skater-skating-speed-detail/${playerId}/${season}/2` },
        { key: 'skatingDistance', label: 'Skating distance', path: `/edge/skater-skating-distance-detail/${playerId}/${season}/2` },
        { key: 'shotSpeed', label: 'Shot speed', path: `/edge/skater-shot-speed-detail/${playerId}/${season}/2` },
        { key: 'shotLocation', label: 'Shot location', path: `/edge/skater-shot-location-detail/${playerId}/${season}/2` },
        { key: 'zoneTime', label: 'Zone time', path: `/edge/skater-zone-time/${playerId}/${season}/2` },
        { key: 'landing', label: 'Skater league leaders', path: `/edge/skater-landing/${season}/2` }
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
