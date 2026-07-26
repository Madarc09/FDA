const NHL_WEB = 'https://api-web.nhle.com/v1';
const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
const TEAMS = ['ANA','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET','EDM','FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK','WPG','WSH'];
const CACHE_MS = 15 * 60 * 1000;
let memoryCache = null;

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const local = value => value?.default || value?.en || value?.fr || value || '';
const pick = (row, keys, fallback = 0) => {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return fallback;
};

async function fetchJson(url, { timeout = 16000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'FantraxDraftAssist/3.0' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function reportUrl(type, report, season) {
  const params = new URLSearchParams({
    isAggregate: 'false',
    isGame: 'false',
    start: '0',
    limit: '-1',
    cayenneExp: `seasonId=${season} and gameTypeId=2`,
    sort: JSON.stringify([{ property: 'playerId', direction: 'ASC' }])
  });
  return `${NHL_STATS}/${type}/${report}?${params}`;
}

function teamFromRow(row) {
  const raw = row?.teamAbbrevs || row?.teamAbbrev || row?.team || row?.currentTeamAbbrev || '';
  return String(raw).split(',').map(item => item.trim()).filter(Boolean).at(-1) || 'NHL';
}

function normalizePosition(position, playerType = 'skater') {
  if (playerType === 'goalie' || position === 'G') return 'G';
  if (['D','LD','RD'].includes(String(position || '').toUpperCase())) return 'D';
  return String(position || 'F').toUpperCase();
}

function blankStats() {
  return {
    goals: 0, assists: 0, shotsOnGoal: 0, hits: 0, blocks: 0,
    faceoffsWon: 0, faceoffsLost: 0, powerPlayPoints: 0,
    shortHandedPoints: 0, gameWinningGoals: 0, minorPenalties: 0,
    fights: 0, shootoutGoals: 0, hatTricks: 0,
    gordieHoweHatTricks: 0, firstStars: 0,
    saves: 0, goalsAgainst: 0, wins: 0, shutouts: 0
  };
}

function rosterRows(payload, team) {
  const rows = [];
  const add = (items, fallbackPosition, playerType) => {
    for (const item of items || []) {
      const id = num(item.id || item.playerId);
      if (!id) continue;
      const first = local(item.firstName);
      const last = local(item.lastName);
      rows.push({
        id,
        name: `${first} ${last}`.trim() || local(item.fullName) || `Player ${id}`,
        team,
        position: normalizePosition(item.positionCode || item.position || fallbackPosition, playerType),
        playerType,
        sweaterNumber: item.sweaterNumber ?? null,
        shootsCatches: item.shootsCatches || null,
        birthDate: item.birthDate || null,
        birthCountry: item.birthCountry || null,
        heightInInches: num(item.heightInInches) || null,
        weightInPounds: num(item.weightInPounds) || null,
        headshot: item.headshot || null,
        heroImage: item.heroImage || null,
        currentRoster: true,
        gamesPlayed: 0,
        stats: blankStats(),
        dataQuality: 'official-roster'
      });
    }
  };
  add(payload?.forwards, 'F', 'skater');
  add(payload?.defensemen || payload?.defencemen, 'D', 'skater');
  add(payload?.goalies, 'G', 'goalie');
  return rows;
}

async function fetchRosters() {
  const results = await Promise.allSettled(TEAMS.map(async team => ({
    team,
    payload: await fetchJson(`${NHL_WEB}/roster/${team}/current`)
  })));
  const rows = [];
  const failedTeams = [];
  for (const result of results) {
    if (result.status === 'fulfilled') rows.push(...rosterRows(result.value.payload, result.value.team));
    else failedTeams.push(result.reason?.message || 'Unknown roster failure');
  }
  return { rows, failedTeams, successfulTeams: TEAMS.length - failedTeams.length };
}

async function fetchReports(season) {
  const requested = [
    ['skater','summary'],
    ['skater','realtime'],
    ['skater','faceoffwins'],
    ['skater','powerplay'],
    ['skater','penaltykill'],
    ['skater','penalties'],
    ['skater','shootout'],
    ['goalie','summary']
  ];
  const results = await Promise.allSettled(requested.map(async ([type, report]) => ({
    key: `${type}:${report}`,
    payload: await fetchJson(reportUrl(type, report, season))
  })));
  const maps = new Map();
  const errors = [];
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const key = requested[index].join(':');
    if (result.status === 'fulfilled') {
      maps.set(key, new Map((result.value.payload?.data || []).map(row => [num(row.playerId), row])));
    } else errors.push(`${key}: ${result.reason?.message || 'failed'}`);
  }
  return { maps, errors };
}

function makeSkater(summary, maps) {
  const id = num(summary.playerId);
  const realtime = maps.get('skater:realtime')?.get(id) || {};
  const faceoff = maps.get('skater:faceoffwins')?.get(id) || {};
  const powerplay = maps.get('skater:powerplay')?.get(id) || {};
  const penaltykill = maps.get('skater:penaltykill')?.get(id) || {};
  const penalties = maps.get('skater:penalties')?.get(id) || {};
  const shootout = maps.get('skater:shootout')?.get(id) || {};
  const faceoffWins = num(pick(faceoff, ['faceoffWins','faceoffsWon','wins']));
  const totalFaceoffs = num(pick(faceoff, ['totalFaceoffs','faceoffs','faceoffTotal']));
  const faceoffLosses = num(pick(faceoff, ['faceoffLosses','faceoffsLost','losses'], Math.max(0, totalFaceoffs - faceoffWins)));
  const stats = blankStats();
  Object.assign(stats, {
    goals: num(pick(summary, ['goals'])),
    assists: num(pick(summary, ['assists'])),
    shotsOnGoal: num(pick(summary, ['shots','shotsOnGoal'])),
    gameWinningGoals: num(pick(summary, ['gameWinningGoals'])),
    hatTricks: num(pick(summary, ['hatTricks'])),
    hits: num(pick(realtime, ['hits'])),
    blocks: num(pick(realtime, ['blockedShots','blocks'])),
    faceoffsWon: faceoffWins,
    faceoffsLost: faceoffLosses,
    powerPlayPoints: num(pick(powerplay, ['ppPoints','powerPlayPoints'], num(pick(powerplay,['ppGoals'])) + num(pick(powerplay,['ppAssists'])))),
    shortHandedPoints: num(pick(penaltykill, ['shPoints','shortHandedPoints'], num(pick(penaltykill,['shGoals'])) + num(pick(penaltykill,['shAssists'])))),
    minorPenalties: num(pick(penalties, ['minorPenalties','minors'])),
    fights: num(pick(penalties, ['fightingMajors','fights'])),
    shootoutGoals: num(pick(shootout, ['shootoutGoals','goals']))
  });
  return {
    id,
    name: summary.skaterFullName || summary.playerName || `Player ${id}`,
    team: teamFromRow(summary),
    position: normalizePosition(summary.positionCode || summary.position || 'F'),
    playerType: 'skater',
    gamesPlayed: num(summary.gamesPlayed),
    stats,
    currentRoster: false,
    dataQuality: 'official-season-reports'
  };
}

function makeGoalie(row) {
  const id = num(row.playerId);
  const shotsAgainst = num(pick(row, ['shotsAgainst']));
  const goalsAgainst = num(pick(row, ['goalsAgainst']));
  const stats = blankStats();
  Object.assign(stats, {
    wins: num(pick(row, ['wins'])),
    saves: num(pick(row, ['saves'], Math.max(0, shotsAgainst - goalsAgainst))),
    goalsAgainst,
    shutouts: num(pick(row, ['shutouts'])),
    assists: num(pick(row, ['assists'])),
    goals: num(pick(row, ['goals']))
  });
  return {
    id,
    name: row.goalieFullName || row.playerName || `Player ${id}`,
    team: teamFromRow(row),
    position: 'G',
    playerType: 'goalie',
    gamesPlayed: num(row.gamesPlayed),
    stats,
    currentRoster: false,
    dataQuality: 'official-season-reports'
  };
}

function mergePlayer(base, next) {
  if (!base) return { ...next, stats: { ...blankStats(), ...(next.stats || {}) } };
  const nextHasGames = num(next.gamesPlayed) > 0;
  return {
    ...base,
    ...next,
    name: next.name && !String(next.name).startsWith('Player ') ? next.name : base.name,
    team: nextHasGames ? next.team : (base.team || next.team),
    position: base.position && base.position !== 'F' ? base.position : next.position,
    playerType: base.playerType === 'goalie' || next.playerType === 'goalie' ? 'goalie' : 'skater',
    headshot: base.headshot || next.headshot || null,
    heroImage: base.heroImage || next.heroImage || null,
    currentRoster: Boolean(base.currentRoster || next.currentRoster),
    gamesPlayed: Math.max(num(base.gamesPlayed), num(next.gamesPlayed)),
    stats: nextHasGames ? { ...blankStats(), ...(base.stats || {}), ...(next.stats || {}) } : { ...blankStats(), ...(next.stats || {}), ...(base.stats || {}) },
    dataQuality: nextHasGames ? next.dataQuality : base.dataQuality
  };
}

async function buildPlayerDirectory(season) {
  const [rosters, reports] = await Promise.all([fetchRosters(), fetchReports(season)]);
  const byId = new Map();
  for (const row of rosters.rows) byId.set(row.id, mergePlayer(byId.get(row.id), row));

  const skaterSummary = reports.maps.get('skater:summary');
  if (skaterSummary) for (const row of skaterSummary.values()) {
    const player = makeSkater(row, reports.maps);
    byId.set(player.id, mergePlayer(byId.get(player.id), player));
  }
  const goalieSummary = reports.maps.get('goalie:summary');
  if (goalieSummary) for (const row of goalieSummary.values()) {
    const player = makeGoalie(row);
    byId.set(player.id, mergePlayer(byId.get(player.id), player));
  }

  const players = [...byId.values()]
    .filter(player => player.id && player.name)
    .map(player => ({
      ...player,
      headshot: player.headshot || `https://assets.nhle.com/mugs/nhl/${season}/${player.team}/${player.id}.png`,
      stats: { ...blankStats(), ...(player.stats || {}) }
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name));

  if (players.length < 300) {
    throw new Error(`NHL directory returned only ${players.length} players; refusing to present it as complete.`);
  }

  return {
    season,
    generatedAt: new Date().toISOString(),
    players,
    metadata: {
      source: 'Official NHL current rosters plus NHL Stats season reports',
      playerCount: players.length,
      currentRosterCount: players.filter(player => player.currentRoster).length,
      skaterCount: players.filter(player => player.playerType === 'skater').length,
      goalieCount: players.filter(player => player.playerType === 'goalie').length,
      successfulRosterTeams: rosters.successfulTeams,
      failedRosterTeams: rosters.failedTeams,
      reportErrors: reports.errors,
      exactSpecialEventsIncluded: false,
      note: 'First stars, exact minor-penalty classification, fights, shootout goals and hat-trick bonuses become exact after the scheduled Gamecenter sync.'
    }
  };
}

export default async function handler(req, res) {
  const season = /^\d{8}$/.test(String(req.query?.season || '')) ? String(req.query.season) : '20252026';
  try {
    if (memoryCache?.season === season && Date.now() - memoryCache.createdAt < CACHE_MS) {
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
      return res.status(200).json(memoryCache.payload);
    }
    const payload = await buildPlayerDirectory(season);
    memoryCache = { season, createdAt: Date.now(), payload };
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: error?.message || 'The official NHL player directory could not be loaded.',
      season,
      players: []
    });
  }
}
