import { buildScheduleDataset } from '../lib/calendar-engine.js';

const CACHE_MS = 6 * 60 * 60 * 1000;
let memoryCache = null;

export default async function handler(req, res) {
  const season = /^\d{8}$/.test(String(req.query?.season || '')) ? String(req.query.season) : '20262027';
  try {
    if (memoryCache?.season === season && Date.now() - memoryCache.createdAt < CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json(memoryCache.payload);
    }
    const payload = await buildScheduleDataset(season);
    memoryCache = { season, createdAt: Date.now(), payload };
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'The official NHL schedule could not be loaded.',
      season,
      games: [],
      teams: {}
    });
  }
}
