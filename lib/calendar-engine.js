export const NHL_WEB = 'https://api-web.nhle.com/v1';
export const NHL_TEAMS = ['ANA','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET','EDM','FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK','WPG','WSH'];

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const teamCode = value => value?.abbrev || value?.triCode || value?.placeName?.default || value?.commonName?.default || '';

export async function fetchJson(url, { timeout = 20000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'FantraxDraftAssist/4.0' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 450 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function normalizeGame(game) {
  const away = teamCode(game.awayTeam);
  const home = teamCode(game.homeTeam);
  return {
    id: number(game.id),
    season: number(game.season),
    gameType: number(game.gameType),
    date: game.gameDate,
    startTimeUTC: game.startTimeUTC || null,
    away,
    home,
    neutralSite: Boolean(game.neutralSite)
  };
}

function countBackToBacks(dates) {
  const sorted = [...dates].sort();
  let total = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T12:00:00Z`);
    const current = new Date(`${sorted[index]}T12:00:00Z`);
    if ((current - previous) / 86400000 === 1) total += 1;
  }
  return total;
}

function dayCounts(dates) {
  const counts = { SUN:0, MON:0, TUE:0, WED:0, THU:0, FRI:0, SAT:0 };
  for (const date of dates) {
    const day = ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date(`${date}T12:00:00Z`).getUTCDay()];
    counts[day] += 1;
  }
  return counts;
}

export async function buildScheduleDataset(season = '20262027') {
  if (!/^\d{8}$/.test(String(season))) throw new Error('Season must use the NHL YYYYYYYY format.');

  const results = await Promise.allSettled(NHL_TEAMS.map(async team => ({
    team,
    payload: await fetchJson(`${NHL_WEB}/club-schedule-season/${team}/${season}`)
  })));

  const failures = [];
  const gameMap = new Map();
  const returnedTeamCounts = {};

  for (const result of results) {
    if (result.status !== 'fulfilled') {
      failures.push(result.reason?.message || 'Unknown schedule request failure');
      continue;
    }
    const { team, payload } = result.value;
    const games = (payload?.games || [])
      .map(normalizeGame)
      .filter(game => game.id && game.gameType === 2 && String(game.season) === String(season) && game.date && game.away && game.home);
    returnedTeamCounts[team] = games.length;
    for (const game of games) gameMap.set(game.id, game);
  }

  const games = [...gameMap.values()].sort((a, b) => a.date.localeCompare(b.date) || String(a.startTimeUTC || '').localeCompare(String(b.startTimeUTC || '')));
  const teamDates = Object.fromEntries(NHL_TEAMS.map(team => [team, []]));
  const teamGames = Object.fromEntries(NHL_TEAMS.map(team => [team, []]));
  const leagueGamesByDate = {};

  for (const game of games) {
    leagueGamesByDate[game.date] = (leagueGamesByDate[game.date] || 0) + 1;
    for (const team of [game.away, game.home]) {
      if (!teamDates[team]) continue;
      teamDates[team].push(game.date);
      teamGames[team].push(game.id);
    }
  }

  const teams = {};
  for (const team of NHL_TEAMS) {
    const dates = [...new Set(teamDates[team])].sort();
    teams[team] = {
      games: teamGames[team],
      dates,
      gameCount: teamGames[team].length,
      backToBacks: countBackToBacks(dates),
      dayCounts: dayCounts(dates)
    };
  }

  const completeTeams = NHL_TEAMS.filter(team => teams[team].gameCount >= 80).length;
  if (games.length < 1200 || completeTeams < 30) {
    throw new Error(`Official NHL schedule import is incomplete: ${games.length} unique games and ${completeTeams}/32 substantially complete teams.`);
  }

  const dates = games.map(game => game.date);
  return {
    season: String(season),
    generatedAt: new Date().toISOString(),
    source: 'Official NHL club schedule-season endpoints',
    metadata: {
      gameCount: games.length,
      teamCount: NHL_TEAMS.length,
      successfulTeamRequests: NHL_TEAMS.length - failures.length,
      requestFailures: failures,
      startDate: dates[0] || null,
      endDate: dates.at(-1) || null,
      expectedGamesPerTeam: Math.round((games.length * 2) / NHL_TEAMS.length),
      teamGameCounts: returnedTeamCounts
    },
    leagueGamesByDate,
    teams,
    games
  };
}
