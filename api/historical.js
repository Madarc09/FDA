const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
const NHL_WEB = 'https://api-web.nhle.com/v1';
const CACHE_MS = 6 * 60 * 60 * 1000;
let memoryCache = null;

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const local = value => value?.default || value?.en || value?.fr || value || '';
const pick = (row, keys, fallback = 0) => {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return fallback;
};

async function fetchJson(url, { timeout = 18000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'FantraxDraftAssist/5.0' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function reportUrl(type, report, { aggregate = true, limit = 50, sort = 'points', fact = 'gamesPlayed>=1' } = {}) {
  const sortRules = [{ property: sort, direction: 'DESC' }];
  if (sort !== 'gamesPlayed') sortRules.push({ property: 'gamesPlayed', direction: 'ASC' });
  sortRules.push({ property: 'playerId', direction: 'ASC' });
  const params = new URLSearchParams({
    isAggregate: String(aggregate),
    isGame: 'false',
    start: '0',
    limit: String(limit),
    cayenneExp: 'gameTypeId=2',
    sort: JSON.stringify(sortRules)
  });
  if (fact) params.set('factCayenneExp', fact);
  return `${NHL_STATS}/${type}/${report}?${params}`;
}

function seasonLabel(seasonId) {
  const raw = String(seasonId || '');
  if (!/^\d{8}$/.test(raw)) return raw || 'Career';
  return `${raw.slice(0,4)}-${raw.slice(6)}`;
}

function normalizeSkater(row, mode = 'career') {
  const id = num(row.playerId);
  const gamesPlayed = num(row.gamesPlayed);
  const goals = num(row.goals);
  const assists = num(row.assists);
  const points = num(pick(row, ['points'], goals + assists));
  const team = String(pick(row, ['teamAbbrevs','teamAbbrev','team'], 'NHL')).split(',').map(value => value.trim()).filter(Boolean).at(-1) || 'NHL';
  return {
    id,
    name: row.skaterFullName || row.playerName || `Player ${id}`,
    position: row.positionCode || row.position || 'F',
    team,
    seasonId: row.seasonId ? String(row.seasonId) : null,
    seasonLabel: row.seasonId ? seasonLabel(row.seasonId) : 'Career',
    gamesPlayed,
    goals,
    assists,
    points,
    pointsPerGame: gamesPlayed ? points / gamesPlayed : 0,
    plusMinus: num(row.plusMinus),
    penaltyMinutes: num(pick(row, ['penaltyMinutes','pim'])),
    powerPlayGoals: num(row.ppGoals),
    powerPlayPoints: num(pick(row, ['ppPoints','powerPlayPoints'])),
    gameWinningGoals: num(row.gameWinningGoals),
    shots: num(pick(row, ['shots','shotsOnGoal'])),
    shootingPct: num(pick(row, ['shootingPct','shootingPercentage'])),
    headshot: `https://assets.nhle.com/mugs/nhl/latest/${id}.png`,
    mode
  };
}

function normalizeGoalie(row, mode = 'career') {
  const id = num(row.playerId);
  const gamesPlayed = num(row.gamesPlayed);
  const wins = num(row.wins);
  const losses = num(row.losses);
  const goalsAgainst = num(row.goalsAgainst);
  const shotsAgainst = num(row.shotsAgainst);
  const saves = num(pick(row, ['saves'], Math.max(0, shotsAgainst - goalsAgainst)));
  const team = String(pick(row, ['teamAbbrevs','teamAbbrev','team'], 'NHL')).split(',').map(value => value.trim()).filter(Boolean).at(-1) || 'NHL';
  return {
    id,
    name: row.goalieFullName || row.playerName || `Goalie ${id}`,
    position: 'G',
    team,
    seasonId: row.seasonId ? String(row.seasonId) : null,
    seasonLabel: row.seasonId ? seasonLabel(row.seasonId) : 'Career',
    gamesPlayed,
    starts: num(row.gamesStarted),
    wins,
    losses,
    ties: num(row.ties),
    overtimeLosses: num(pick(row, ['otLosses','overtimeLosses'])),
    shutouts: num(row.shutouts),
    saves,
    shotsAgainst,
    goalsAgainst,
    savePct: num(pick(row, ['savePct','savePercentage'])),
    goalsAgainstAverage: num(pick(row, ['goalsAgainstAverage','gaa'])),
    headshot: `https://assets.nhle.com/mugs/nhl/latest/${id}.png`,
    mode
  };
}

async function queryRows(type, report, options, normalizer) {
  const payload = await fetchJson(reportUrl(type, report, options));
  return (payload?.data || []).map(row => normalizer(row, options.aggregate ? 'career' : 'season')).filter(row => row.id);
}

function uniqueByPlayer(rows) {
  const seen = new Set();
  return rows.filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function buildHistory() {
  const requests = {
    careerPoints: queryRows('skater','summary',{ aggregate:true, limit:75, sort:'points' },normalizeSkater),
    careerGoals: queryRows('skater','summary',{ aggregate:true, limit:30, sort:'goals' },normalizeSkater),
    careerAssists: queryRows('skater','summary',{ aggregate:true, limit:30, sort:'assists' },normalizeSkater),
    careerGames: queryRows('skater','summary',{ aggregate:true, limit:30, sort:'gamesPlayed' },normalizeSkater),
    seasonPoints: queryRows('skater','summary',{ aggregate:false, limit:40, sort:'points' },normalizeSkater),
    seasonGoals: queryRows('skater','summary',{ aggregate:false, limit:25, sort:'goals' },normalizeSkater),
    seasonAssists: queryRows('skater','summary',{ aggregate:false, limit:25, sort:'assists' },normalizeSkater),
    goalieCareerWins: queryRows('goalie','summary',{ aggregate:true, limit:40, sort:'wins' },normalizeGoalie),
    goalieCareerShutouts: queryRows('goalie','summary',{ aggregate:true, limit:25, sort:'shutouts' },normalizeGoalie),
    goalieSeasonWins: queryRows('goalie','summary',{ aggregate:false, limit:25, sort:'wins' },normalizeGoalie)
  };
  const keys = Object.keys(requests);
  const settled = await Promise.allSettled(Object.values(requests));
  const data = {};
  const errors = [];
  settled.forEach((result, index) => {
    const key = keys[index];
    if (result.status === 'fulfilled') data[key] = result.value;
    else {
      data[key] = [];
      errors.push(`${key}: ${result.reason?.message || 'failed'}`);
    }
  });

  if (!data.careerPoints?.length || !data.seasonPoints?.length || !data.goalieCareerWins?.length) {
    throw new Error(`Official NHL historical reports were incomplete. ${errors.join(' | ')}`);
  }

  const defenseCareer = data.careerPoints.filter(player => String(player.position).toUpperCase() === 'D').slice(0,20);
  const defenseSeasons = data.seasonPoints.filter(player => String(player.position).toUpperCase() === 'D').slice(0,20);

  return {
    generatedAt: new Date().toISOString(),
    source: 'Official NHL Stats historical reports',
    coverage: {
      core: 'Goals, assists, player totals and game history across the NHL statistical archive.',
      modern: 'Shots, hits, blocks, faceoffs, time on ice and related categories vary by tracked era.',
      edge: 'NHL EDGE puck-and-player tracking is available from 2021-22 onward.'
    },
    leaders: {
      careerPoints: data.careerPoints.slice(0,25),
      careerGoals: data.careerGoals.slice(0,20),
      careerAssists: data.careerAssists.slice(0,20),
      careerGames: uniqueByPlayer(data.careerGames).slice(0,20),
      seasonPoints: data.seasonPoints.slice(0,25),
      seasonGoals: data.seasonGoals.slice(0,20),
      seasonAssists: data.seasonAssists.slice(0,20),
      defenseCareer,
      defenseSeasons,
      goalieCareerWins: data.goalieCareerWins.slice(0,20),
      goalieCareerShutouts: data.goalieCareerShutouts.slice(0,20),
      goalieSeasonWins: data.goalieSeasonWins.slice(0,20)
    },
    records: {
      careerPoints: data.careerPoints[0] || null,
      careerGoals: data.careerGoals[0] || null,
      seasonPoints: data.seasonPoints[0] || null,
      goalieWins: data.goalieCareerWins[0] || null
    },
    errors
  };
}

function normalizeLanding(payload) {
  const first = local(payload?.firstName);
  const last = local(payload?.lastName);
  const fullName = `${first} ${last}`.trim() || local(payload?.fullName) || 'Historical player';
  const seasonTotals = (payload?.seasonTotals || [])
    .filter(row => Number(row.gameTypeId) === 2 && (!row.leagueAbbrev || String(row.leagueAbbrev).toUpperCase() === 'NHL'))
    .map(row => ({
      seasonId: String(row.season || row.seasonId || ''),
      seasonLabel: seasonLabel(row.season || row.seasonId),
      team: local(row.teamName) || local(row.teamCommonName) || row.teamAbbrev || 'NHL',
      teamAbbrev: row.teamAbbrev || '',
      gamesPlayed: num(row.gamesPlayed),
      goals: num(row.goals),
      assists: num(row.assists),
      points: num(pick(row, ['points'], num(row.goals) + num(row.assists))),
      penaltyMinutes: num(pick(row, ['pim','penaltyMinutes'])),
      shots: num(pick(row, ['shots','shotsOnGoal'])),
      hits: num(row.hits),
      blocks: num(pick(row, ['blockedShots','blocks'])),
      faceoffWins: num(pick(row, ['faceoffWins','faceoffsWon'])),
      faceoffLosses: num(pick(row, ['faceoffLosses','faceoffsLost'])),
      powerPlayPoints: num(pick(row, ['powerPlayPoints','ppPoints'], num(row.powerPlayGoals) + num(row.powerPlayAssists))),
      shortHandedPoints: num(pick(row, ['shortHandedPoints','shPoints'], num(row.shorthandedGoals) + num(row.shorthandedAssists))),
      gameWinningGoals: num(row.gameWinningGoals),
      wins: num(row.wins),
      losses: num(row.losses),
      shutouts: num(row.shutouts),
      saves: num(pick(row, ['saves'], Math.max(0, num(row.shotsAgainst) - num(row.goalsAgainst)))),
      shotsAgainst: num(row.shotsAgainst),
      goalsAgainst: num(row.goalsAgainst),
      savePct: num(pick(row, ['savePctg','savePct','savePercentage'])),
      goalsAgainstAverage: num(pick(row, ['goalsAgainstAvg','goalsAgainstAverage','gaa']))
    }))
    .sort((a,b) => String(b.seasonId).localeCompare(String(a.seasonId)));

  return {
    id: num(payload?.playerId),
    name: fullName,
    position: payload?.position || payload?.positionCode || '',
    shootsCatches: payload?.shootsCatches || '',
    birthDate: payload?.birthDate || '',
    birthCity: local(payload?.birthCity),
    birthStateProvince: local(payload?.birthStateProvince),
    birthCountry: payload?.birthCountry || '',
    heightInInches: num(payload?.heightInInches),
    weightInPounds: num(payload?.weightInPounds),
    headshot: payload?.headshot || `https://assets.nhle.com/mugs/nhl/latest/${num(payload?.playerId)}.png`,
    heroImage: payload?.heroImage || '',
    isActive: Boolean(payload?.isActive),
    seasonTotals
  };
}

export default async function handler(req, res) {
  const playerId = num(req.query?.playerId);
  try {
    if (playerId) {
      const payload = await fetchJson(`${NHL_WEB}/player/${playerId}/landing`);
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).json({ source:'Official NHL player landing', generatedAt:new Date().toISOString(), player:normalizeLanding(payload) });
    }

    if (memoryCache && Date.now() - memoryCache.createdAt < CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json(memoryCache.payload);
    }
    const payload = await buildHistory();
    memoryCache = { createdAt: Date.now(), payload };
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'Official NHL historical data could not be loaded.',
      generatedAt: new Date().toISOString()
    });
  }
}
