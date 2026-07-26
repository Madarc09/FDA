const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
const NHL_WEB = 'https://api-web.nhle.com/v1';
const NHL_ASSETS = 'https://assets.nhle.com';
const OFFLINE_PREVIEW = new URLSearchParams(location.search).has('offline');
const memoryStorage = new Map();
const storage = {
  getItem(key) { try { return localStorage.getItem(key); } catch { return memoryStorage.get(key) ?? null; } },
  setItem(key, value) { try { localStorage.setItem(key, value); } catch { memoryStorage.set(key, String(value)); } },
  removeItem(key) { try { localStorage.removeItem(key); } catch { memoryStorage.delete(key); } }
};


const DEFAULT_RULES = {
  skater: {
    firstStars: { label: '1st Stars', short: '1Star', value: 3 },
    assists: { label: 'Assists', short: 'A', value: 2.5 },
    blocks: { label: 'Blocks', short: 'Blk', value: 0.5 },
    faceoffsLost: { label: 'Faceoffs Lost', short: 'FOL', value: -0.2 },
    faceoffsWon: { label: 'Faceoffs Won', short: 'FOW', value: 0.2 },
    fights: { label: 'Fights', short: 'Ft', value: 3 },
    gameWinningGoals: { label: 'Game-winning Goals', short: 'GWG', value: 2 },
    goals: { label: 'Goals', short: 'G', value: 3.5 },
    gordieHoweHatTricks: { label: 'Gordie Howe Hat Tricks', short: 'GHHT', value: 3 },
    hatTricks: { label: 'Hat Tricks', short: 'HT', value: 3 },
    hits: { label: 'Hits', short: 'Hit', value: 0.25 },
    minorPenalties: { label: 'Minor Penalties', short: 'MnP', value: 2 },
    powerPlayPoints: { label: 'Power Play Points', short: 'PPP', value: 1 },
    shootoutGoals: { label: 'Shootout Goals', short: 'SG', value: 2 },
    shortHandedPoints: { label: 'Short-Handed Points', short: 'SHP', value: 2 },
    shotsOnGoal: { label: 'Shots on Goal', short: 'SOG', value: 0.25 }
  },
  goalie: {
    firstStars: { label: '1st Stars', short: '1Star', value: 3 },
    assists: { label: 'Assists', short: 'A', value: 5 },
    goals: { label: 'Goals', short: 'G', value: 50 },
    goalsAgainst: { label: 'Goals Against', short: 'GA', value: -1 },
    saves: { label: 'Saves', short: 'SV', value: 0.25 },
    shutouts: { label: 'Shutouts', short: 'SHO', value: 3 },
    wins: { label: 'Wins', short: 'W', value: 5 }
  }
};

const OFFLINE_VALIDATION = [
  { id: 8471675, name: 'Sidney Crosby', team: 'PIT', position: 'C', playerType: 'skater', gamesPlayed: 68, dataQuality: 'verified-sample', stats: { goals:29, assists:45, shotsOnGoal:160, hits:60, blocks:30, faceoffsWon:773, faceoffsLost:628, powerPlayPoints:23, gameWinningGoals:4, minorPenalties:17, firstStars:7, shootoutGoals:2 } },
  { id: 8471215, name: 'Evgeni Malkin', team: 'PIT', position: 'C', playerType: 'skater', gamesPlayed: 56, dataQuality: 'verified-sample', stats: { goals:19, assists:42, shotsOnGoal:148, hits:24, blocks:17, faceoffsWon:109, faceoffsLost:136, powerPlayPoints:22, gameWinningGoals:3, minorPenalties:23, firstStars:6, shootoutGoals:1, hatTricks:1 } },
  { id: 8484153, name: 'Easton Cowan', team: 'TOR', position: 'RW', playerType: 'skater', gamesPlayed: 66, dataQuality: 'verified-sample', stats: { goals:11, assists:18, shotsOnGoal:92, hits:72, blocks:32, faceoffsWon:2, faceoffsLost:4, powerPlayPoints:6, gameWinningGoals:1, minorPenalties:15, fights:1, firstStars:1 } }
];

const state = {
  season: '20252026',
  players: [],
  filteredPlayers: [],
  selectedPlayerId: null,
  dataMode: 'loading',
  metadata: null,
  rules: loadRules(),
  roster: loadRoster(),
  watchlist: new Set(JSON.parse(storage.getItem('fda-watchlist') || '[]')),
  visibleCount: 60,
  diagnostics: [],
  route: 'dashboard'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = (value, digits = 2) => Number(number(value).toFixed(digits));
const fmt = (value, digits = 1) => number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const safeText = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function loadRules() {
  try {
    const saved = JSON.parse(storage.getItem('fda-scoring-rules'));
    if (!saved) return structuredClone(DEFAULT_RULES);
    const next = structuredClone(DEFAULT_RULES);
    for (const type of ['skater','goalie']) {
      for (const key of Object.keys(next[type])) {
        if (saved[type]?.[key]?.value !== undefined) next[type][key].value = number(saved[type][key].value);
      }
    }
    return next;
  } catch { return structuredClone(DEFAULT_RULES); }
}

function loadRoster() {
  try { return JSON.parse(storage.getItem('fda-roster') || '[]').map(Number); }
  catch { return []; }
}

function saveRoster() { storage.setItem('fda-roster', JSON.stringify(state.roster)); }
function saveRules() { storage.setItem('fda-scoring-rules', JSON.stringify(state.rules)); }

function addDiagnostic(title, detail, status = 'ok', value = '') {
  state.diagnostics.push({ title, detail, status, value, time: new Date().toISOString() });
  renderDiagnostics();
}

function setLiveStatus(status, text) {
  const dot = $('#liveDot');
  dot.className = status === 'live' ? 'live' : status === 'error' ? 'error' : '';
  $('#liveText').textContent = text;
}

function getTeam(row) {
  const raw = row.teamAbbrevs || row.teamAbbrev || row.team || row.currentTeamAbbrev || '';
  return String(raw).split(',').map(x => x.trim()).filter(Boolean).at(-1) || 'NHL';
}

function getName(row) {
  return row.skaterFullName || row.goalieFullName || row.playerName || row.name?.default || row.name || `Player ${row.playerId || row.id || ''}`;
}

function pick(row, keys, fallback = 0) {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return fallback;
}

function headshotUrl(player) {
  if (player.headshot) return player.headshot;
  return `${NHL_ASSETS}/mugs/nhl/${state.season}/${player.team}/${player.id}.png`;
}

function teamLogoUrl(team) { return `${NHL_ASSETS}/logos/nhl/svg/${team}_light.svg`; }

function normalizeSyncedPlayer(player) {
  const stats = { ...(player.stats || {}) };
  return calculatePlayer({
    ...player,
    id: number(player.id || player.playerId),
    name: player.name || player.fullName,
    team: player.team || 'NHL',
    position: player.position || (player.playerType === 'goalie' ? 'G' : 'F'),
    playerType: player.playerType || (player.position === 'G' ? 'goalie' : 'skater'),
    gamesPlayed: number(player.gamesPlayed || stats.gamesPlayed),
    stats,
    games: Array.isArray(player.games) ? player.games : [],
    dataQuality: player.dataQuality || 'exact'
  });
}

function calculatePlayer(player) {
  const type = player.playerType === 'goalie' || player.position === 'G' ? 'goalie' : 'skater';
  const rules = state.rules[type];
  let fantasyPoints = 0;
  for (const [key, rule] of Object.entries(rules)) fantasyPoints += number(player.stats?.[key]) * number(rule.value);
  const gamesPlayed = number(player.gamesPlayed || player.stats?.gamesPlayed);
  const fpg = gamesPlayed ? fantasyPoints / gamesPlayed : 0;
  const gameRows = (Array.isArray(player.games) ? player.games : []).map(game => {
    const gamePoints = game.stats ? Object.entries(rules).reduce((sum,[key,rule]) => sum + number(game.stats?.[key]) * number(rule.value), 0) : number(game.fantasyPoints);
    return { ...game, fantasyPoints: round(gamePoints, 2) };
  });
  const recentGames = gameRows.filter(game => {
    const date = new Date(game.date || game.gameDate || 0);
    return Number.isFinite(date.getTime()) && Date.now() - date.getTime() <= 7 * 86400000;
  });
  const recentFpts = recentGames.reduce((sum, game) => sum + number(game.fantasyPoints), 0);
  const recentFpg = recentGames.length ? recentFpts / recentGames.length : 0;
  const change = recentGames.length ? recentFpg - fpg : 0;
  const trend = recentGames.length < 2 ? 'flat' : change > Math.max(.35, fpg * .08) ? 'up' : change < -Math.max(.35, fpg * .08) ? 'down' : 'flat';
  return { ...player, games: gameRows, playerType: type, fantasyPoints: round(fantasyPoints, 2), fpg: round(fpg, 4), recentFpg: round(recentFpg, 3), recentGames: recentGames.length, trend, trendDelta: round(change, 3) };
}

function currentQuery(report) {
  const params = new URLSearchParams({
    isAggregate: 'false', isGame: 'false', start: '0', limit: '-1',
    factCayenneExp: 'gamesPlayed>=1', cayenneExp: `gameTypeId=2 and seasonId=${state.season}`
  });
  params.set('sort', JSON.stringify([{ property: 'playerId', direction: 'ASC' }]));
  return `${NHL_STATS}/skater/${report}?${params}`;
}

function goalieQuery() {
  const params = new URLSearchParams({
    isAggregate: 'false', isGame: 'false', start: '0', limit: '-1',
    factCayenneExp: 'gamesPlayed>=1', cayenneExp: `gameTypeId=2 and seasonId=${state.season}`
  });
  params.set('sort', JSON.stringify([{ property: 'playerId', direction: 'ASC' }]));
  return `${NHL_STATS}/goalie/summary?${params}`;
}

async function fetchJson(url, { timeout = 18000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

async function loadSyncedData() {
  try {
    const response = await fetch(`data/players.json?season=${state.season}&t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const payload = await response.json();
    if (String(payload.season) !== state.season || !Array.isArray(payload.players) || payload.players.length < 50) return false;
    state.players = payload.players.map(normalizeSyncedPlayer).filter(player => player.id && player.gamesPlayed >= 0);
    state.metadata = payload.metadata || {};
    const validationPassed = Boolean(state.metadata?.validation?.passed);
    state.dataMode = validationPassed ? 'exact' : 'synced-unvalidated';
    addDiagnostic('Synced NHL game database', `${state.players.length} players loaded from the automated game collector.`, validationPassed ? 'ok' : 'warn', validationPassed ? 'Exact' : 'Audit required');
    if (state.metadata?.validation) addDiagnostic('Fantrax validation suite', state.metadata.validation.message || 'Validation status recorded.', validationPassed ? 'ok' : 'warn', validationPassed ? '3 / 3 match' : 'Mismatch');
    return true;
  } catch (error) {
    addDiagnostic('Synced data file', `No completed sync file for ${state.season}: ${error.message}`, 'warn', 'Fallback');
    return false;
  }
}

async function loadLiveReports() {
  state.dataMode = 'live';
  const reports = ['summary','realtime','faceoffpercentages','powerplay','penaltykill','penalties','shootout'];
  const reportResults = await Promise.allSettled(reports.map(report => fetchJson(currentQuery(report)).then(data => ({ report, data }))));
  const maps = {};
  let successful = 0;
  for (const result of reportResults) {
    if (result.status === 'fulfilled') {
      const { report, data } = result.value;
      maps[report] = new Map((data.data || []).map(row => [number(row.playerId), row]));
      successful++;
      addDiagnostic(`NHL skater report: ${report}`, `${data.data?.length || 0} records received.`, 'ok', 'Live');
    } else addDiagnostic('NHL skater report failed', result.reason?.message || 'Unknown request failure', 'warn', 'Partial');
  }
  if (!maps.summary?.size) throw new Error('The NHL skater summary report did not return player records.');

  const skaters = [...maps.summary.values()].map(summary => {
    const id = number(summary.playerId);
    const realtime = maps.realtime?.get(id) || {};
    const faceoff = maps.faceoffpercentages?.get(id) || {};
    const powerplay = maps.powerplay?.get(id) || {};
    const penaltykill = maps.penaltykill?.get(id) || {};
    const penalties = maps.penalties?.get(id) || {};
    const shootout = maps.shootout?.get(id) || {};
    const team = getTeam(summary);
    const position = summary.positionCode || summary.position || 'F';
    const stats = {
      goals: number(pick(summary, ['goals'])), assists: number(pick(summary, ['assists'])),
      shotsOnGoal: number(pick(summary, ['shots','shotsOnGoal'])), gameWinningGoals: number(pick(summary, ['gameWinningGoals'])),
      hits: number(pick(realtime, ['hits'])), blocks: number(pick(realtime, ['blockedShots','blocks'])),
      faceoffsWon: number(pick(faceoff, ['faceoffsWon','faceoffWins'])), faceoffsLost: number(pick(faceoff, ['faceoffsLost','faceoffLosses'])),
      powerPlayPoints: number(pick(powerplay, ['ppPoints','powerPlayPoints'], number(pick(powerplay,['ppGoals'])) + number(pick(powerplay,['ppAssists'])))),
      shortHandedPoints: number(pick(penaltykill, ['shPoints','shortHandedPoints'], number(pick(penaltykill,['shGoals'])) + number(pick(penaltykill,['shAssists'])))),
      minorPenalties: number(pick(penalties, ['minorPenalties','minors'])),
      fights: number(pick(penalties, ['fightingMajors','fights'])),
      shootoutGoals: number(pick(shootout, ['shootoutGoals','goals'])),
      hatTricks: number(pick(summary, ['hatTricks'])),
      firstStars: 0, gordieHoweHatTricks: 0
    };
    return calculatePlayer({ id, name: getName(summary), team, position, playerType:'skater', gamesPlayed:number(summary.gamesPlayed), stats, games:[], dataQuality: successful === reports.length ? 'live-provisional' : 'partial-live' });
  });

  let goalies = [];
  try {
    const goaliePayload = await fetchJson(goalieQuery());
    goalies = (goaliePayload.data || []).map(row => {
      const shotsAgainst = number(pick(row,['shotsAgainst']));
      const goalsAgainst = number(pick(row,['goalsAgainst']));
      const stats = {
        wins:number(pick(row,['wins'])), saves:number(pick(row,['saves'],shotsAgainst-goalsAgainst)), goalsAgainst,
        shutouts:number(pick(row,['shutouts'])), assists:number(pick(row,['assists'])), goals:number(pick(row,['goals'])), firstStars:0
      };
      return calculatePlayer({ id:number(row.playerId), name:getName(row), team:getTeam(row), position:'G', playerType:'goalie', gamesPlayed:number(row.gamesPlayed), stats, games:[], dataQuality:'live-provisional' });
    });
    addDiagnostic('NHL goalie summary', `${goalies.length} goalie records received.`, 'ok', 'Live');
  } catch (error) { addDiagnostic('NHL goalie report failed', error.message, 'warn', 'Skaters only'); }

  state.players = [...skaters, ...goalies].filter(player => player.id && player.gamesPlayed > 0);
  state.metadata = { generatedAt: new Date().toISOString(), source: 'live NHL Stats REST reports', reportCount: successful };
  addDiagnostic('Fantasy calculation', 'Raw report categories were joined by NHL player ID and your scoring formula was applied.', 'ok', 'Derived');
}

function applyVerifiedSamples() {
  const byId = new Map(state.players.map((player,index) => [player.id, { player, index }]));
  for (const sample of OFFLINE_VALIDATION) {
    const existing = byId.get(sample.id);
    if (existing && state.season === '20252026' && state.dataMode !== 'exact') {
      state.players[existing.index] = calculatePlayer({ ...existing.player, ...sample, name: existing.player.name || sample.name, team: existing.player.team || sample.team, position: existing.player.position || sample.position, stats: { ...sample.stats }, dataQuality: 'verified-sample' });
    } else if (!existing) state.players.push(calculatePlayer(sample));
  }
}

async function refreshAllData({ forceLive = false } = {}) {
  state.diagnostics = [];
  state.players = [];
  setLiveStatus('loading', 'Connecting to NHL data…');
  renderLoadingPlayers();
  try {
    const exact = forceLive ? false : await loadSyncedData();
    if (!exact) await loadLiveReports();
    applyVerifiedSamples();
    recalculateAll();
    setLiveStatus(state.dataMode === 'synced-unvalidated' ? 'error' : 'live', state.dataMode === 'exact' ? 'Exact game-event database loaded · 3 validation matches' : state.dataMode === 'synced-unvalidated' ? 'Game-event sync loaded · Fantrax validation needs review' : 'Official NHL reports loaded · event sync pending');
  } catch (error) {
    state.dataMode = 'offline';
    state.players = OFFLINE_VALIDATION.map(calculatePlayer);
    addDiagnostic('Live NHL import unavailable', error.message, 'error', 'Offline samples');
    setLiveStatus('error', 'NHL request unavailable · showing verified offline samples');
    recalculateAll();
  }
}

function recalculateAll() {
  state.players = state.players.map(calculatePlayer).sort((a,b) => b.fpg - a.fpg || b.fantasyPoints - a.fantasyPoints);
  if (!state.selectedPlayerId || !state.players.some(p => p.id === state.selectedPlayerId)) state.selectedPlayerId = state.players[0]?.id || null;
  state.visibleCount = 60;
  populateTeamFilter();
  renderAll();
}

function renderAll() {
  renderDashboard();
  applyPlayerFilters();
  renderLab();
  renderDraft();
  renderRules();
  renderDataMode();
  renderDiagnostics();
}

function renderDashboard() {
  $('#metricPlayers').textContent = state.players.length.toLocaleString('en-US');
  $('#metricExact').textContent = state.players.filter(p => p.dataQuality === 'exact').length.toLocaleString('en-US');
  const generated = state.metadata?.generatedAt ? new Date(state.metadata.generatedAt) : null;
  $('#metricFreshness').textContent = generated && !Number.isNaN(generated.getTime()) ? generated.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Live';
  $('#metricFreshnessSub').textContent = state.dataMode === 'exact' ? 'Validated event sync' : state.dataMode === 'synced-unvalidated' ? 'Event sync · audit warning' : state.dataMode === 'live' ? 'Official API session' : 'Offline fallback';
  $('#specialStep').className = state.dataMode === 'exact' ? 'step done' : 'step';
  const leaders = state.players.filter(p => p.gamesPlayed >= 10).slice(0, 8);
  $('#topLeaders').innerHTML = leaders.map((player,index) => `
    <button class="leader-row" data-open-player="${player.id}">
      <span class="rank">${index+1}</span>
      <img class="headshot" src="${headshotUrl(player)}" alt="" onerror="this.style.opacity=.15" />
      <span class="leader-copy"><strong>${safeText(player.name)}</strong><small>${safeText(player.team)} · ${safeText(player.position)} · ${player.gamesPlayed} GP</small></span>
      <span class="leader-score"><strong>${fmt(player.fpg,2)}</strong><small>${fmt(player.fantasyPoints,1)} FPTS</small></span>
    </button>`).join('') || '<div class="empty-state">No player records loaded.</div>';
}

function populateTeamFilter() {
  const select = $('#teamFilter');
  const current = select.value;
  const teams = [...new Set(state.players.map(p => p.team).filter(Boolean))].sort();
  select.innerHTML = '<option value="ALL">All teams</option>' + teams.map(team => `<option value="${safeText(team)}">${safeText(team)}</option>`).join('');
  if (teams.includes(current)) select.value = current;
}

function positionGroup(player) {
  if (player.playerType === 'goalie' || player.position === 'G') return 'G';
  if (player.position === 'D') return 'D';
  return 'F';
}

function applyPlayerFilters() {
  const search = ($('#playerSearch')?.value || '').trim().toLowerCase();
  const position = $('#positionFilter')?.value || 'ALL';
  const team = $('#teamFilter')?.value || 'ALL';
  const sort = $('#sortFilter')?.value || 'fpg-desc';
  let players = state.players.filter(player => {
    const matchesSearch = !search || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(search);
    const matchesPosition = position === 'ALL' || positionGroup(player) === position;
    const matchesTeam = team === 'ALL' || player.team === team;
    return matchesSearch && matchesPosition && matchesTeam;
  });
  const sorts = {
    'fpg-desc': (a,b) => b.fpg-a.fpg || b.gamesPlayed-a.gamesPlayed,
    'fpts-desc': (a,b) => b.fantasyPoints-a.fantasyPoints,
    'recent-desc': (a,b) => b.recentFpg-a.recentFpg || b.fpg-a.fpg,
    'games-desc': (a,b) => b.gamesPlayed-a.gamesPlayed,
    'name-asc': (a,b) => a.name.localeCompare(b.name)
  };
  players.sort(sorts[sort] || sorts['fpg-desc']);
  state.filteredPlayers = players;
  renderPlayers();
}

function renderLoadingPlayers() {
  $('#playerList').innerHTML = Array.from({length:7},()=>'<div class="skeleton-row panel"></div>').join('');
}

function renderPlayers() {
  $('#playerCountHeading').textContent = state.filteredPlayers.length.toLocaleString('en-US');
  const visible = state.filteredPlayers.slice(0,state.visibleCount);
  $('#playerList').innerHTML = visible.map(player => {
    const trendLabel = player.trend === 'up' ? 'RISING' : player.trend === 'down' ? 'FALLING' : 'HOLD';
    const trendClass = player.trend === 'up' ? 'trend-up' : player.trend === 'down' ? 'trend-down' : 'trend-flat';
    const recent = player.recentGames ? fmt(player.recentFpg,2) : '—';
    return `<article class="player-row">
      <img class="headshot" src="${headshotUrl(player)}" alt="" onerror="this.style.display='none'" />
      <div class="player-main">
        <div class="player-name-line"><strong>${safeText(player.name)}</strong><img class="team-logo" src="${teamLogoUrl(player.team)}" alt="${safeText(player.team)}" onerror="this.remove()" /></div>
        <small>${safeText(player.team)} · ${safeText(player.position)} · ${player.dataQuality === 'exact' ? 'Exact game sync' : player.dataQuality === 'event-sync-unvalidated' ? 'Game sync · validation warning' : 'Official NHL season reports'}</small>
        <div class="player-mobile-stats"><span><b>${player.gamesPlayed}</b> GP</span><span><b>${fmt(player.fantasyPoints,1)}</b> FPTS</span><span><b>${fmt(player.fpg,2)}</b> FP/G</span></div>
      </div>
      <div class="player-score"><strong>${fmt(player.fpg,2)}</strong><small>${recent} recent</small><em class="${trendClass}">${trendLabel}</em></div>
      <span class="row-more">›</span>
      <button class="row-action" data-open-player="${player.id}" aria-label="Open ${safeText(player.name)}"></button>
    </article>`;
  }).join('') || '<div class="empty-state panel">No players match these filters.</div>';
  $('#loadMore').style.display = state.filteredPlayers.length > state.visibleCount ? 'block' : 'none';
}

function selectedPlayer() { return state.players.find(player => player.id === state.selectedPlayerId) || state.players[0] || null; }

function renderLab() {
  const player = selectedPlayer();
  if (!player) return;
  $('#labHeadshot').src = headshotUrl(player); $('#labHeadshot').alt = ''; $('#labHeadshot').onerror = () => { $('#labHeadshot').style.visibility = 'hidden'; }; $('#labHeadshot').style.visibility = 'visible';
  $('#labLogo').src = teamLogoUrl(player.team);
  $('#labMeta').textContent = `${player.team} · ${state.season.slice(0,4)}–${state.season.slice(6)}`;
  $('#labName').textContent = player.name; $('#labPosition').textContent = player.position; $('#labGames').textContent = `${player.gamesPlayed} GP`;
  $('#labDataQuality').textContent = player.dataQuality === 'exact' ? 'Exact game-event sync · Fantrax validation passed' : player.dataQuality === 'event-sync-unvalidated' ? 'Game-event sync loaded · validation mismatch under audit' : player.dataQuality === 'verified-sample' ? 'Verified sample' : 'Live NHL reports · special events pending';
  $('#labFpts').textContent = fmt(player.fantasyPoints,2); $('#labFpg').textContent = fmt(player.fpg,2); $('#labFpgExact').textContent = `${player.fpg.toFixed(4)} exact`;
  $('#labRecent').textContent = player.recentGames ? fmt(player.recentFpg,2) : '—'; $('#labRecentGames').textContent = player.recentGames ? `${player.recentGames} games in 7 days` : 'Game-event sync required';
  const trendLabel = player.trend === 'up' ? 'RISING' : player.trend === 'down' ? 'FALLING' : 'HOLD';
  const trendClass = player.trend === 'up' ? 'trend-up' : player.trend === 'down' ? 'trend-down' : 'trend-flat';
  $('#labTrend').textContent = trendLabel; $('#labTrend').className = trendClass;
  $('#labTrendReason').textContent = player.recentGames < 2 ? 'Waiting for recent game sample' : `${player.trendDelta >= 0 ? '+' : ''}${fmt(player.trendDelta,2)} vs season FP/G`;
  $('#watchPlayer').classList.toggle('active',state.watchlist.has(player.id));
  renderRawStats(player); renderAudit(player); renderTrendChart(player); renderInsights(player); renderGameLog(player); renderSchedulePlaceholder(player);
}

function rawStatEntries(player) {
  const s = player.stats || {};
  if (player.playerType === 'goalie') return [['GP',player.gamesPlayed],['W',s.wins],['SV',s.saves],['GA',s.goalsAgainst],['SHO',s.shutouts],['1Star',s.firstStars],['G',s.goals],['A',s.assists]];
  return [['GP',player.gamesPlayed],['G',s.goals],['A',s.assists],['SOG',s.shotsOnGoal],['Hit',s.hits],['Blk',s.blocks],['FOW',s.faceoffsWon],['FOL',s.faceoffsLost],['PPP',s.powerPlayPoints],['SHP',s.shortHandedPoints],['GWG',s.gameWinningGoals],['MnP',s.minorPenalties],['1Star',s.firstStars],['HT',s.hatTricks],['Ft',s.fights],['SG',s.shootoutGoals]];
}

function renderRawStats(player) {
  $('#rawStats').innerHTML = rawStatEntries(player).map(([label,value]) => `<div><small>${label}</small><strong>${number(value).toLocaleString('en-US')}</strong></div>`).join('');
}

function renderAudit(player) {
  const rules = state.rules[player.playerType];
  const entries = Object.entries(rules).map(([key,rule]) => {
    const count = number(player.stats?.[key]); const points = count * rule.value;
    return { key, label:rule.label, short:rule.short, count, value:rule.value, points };
  }).filter(row => row.count !== 0 || row.points !== 0);
  $('#auditList').innerHTML = entries.map(row => `<div class="audit-row ${row.points < 0 ? 'negative':''}"><span><strong>${safeText(row.label)}</strong><small>${row.count} × ${row.value}</small></span><b>${row.points >= 0 ? '+' : ''}${fmt(row.points,2)}</b></div>`).join('') || '<div class="empty-state">No scoring events available.</div>';
  $('#auditTotal').textContent = fmt(player.fantasyPoints,2);
  $('#auditEquation').textContent = `${entries.length} active scoring categories · ${player.gamesPlayed} games · ${player.fpg.toFixed(4)} fantasy points per game.`;
  $('#auditStatus').textContent = player.dataQuality === 'exact' ? 'Exact game sync' : player.dataQuality === 'event-sync-unvalidated' ? 'Synced · needs audit' : 'Live report calculation';
}

function renderTrendChart(player) {
  const svg = $('#trendChart');
  const games = (player.games || []).slice(-10);
  if (!games.length) {
    const baseline = player.fpg || 1;
    const values = [0.82,1.08,.91,1.18,1.03,1.12,1.22].map(mult => baseline*mult);
    drawChart(svg, values, baseline, true);
    return;
  }
  drawChart(svg, games.map(game => number(game.fantasyPoints)), player.fpg, false, games.map(game => game.date));
}

function drawChart(svg, values, average, preview = false, labels = []) {
  const width=760,height=260,padX=38,padY=28;
  const max=Math.max(...values,average,1)*1.15,min=Math.min(0,...values,average);
  const x=i=>padX+(i*(width-padX*2)/Math.max(1,values.length-1));
  const y=v=>height-padY-((v-min)/(max-min||1))*(height-padY*2);
  const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
  const area=`${padX},${height-padY} ${points} ${x(values.length-1)},${height-padY}`;
  const grid=[.25,.5,.75].map(f=>`<line x1="${padX}" x2="${width-padX}" y1="${padY+(height-padY*2)*f}" y2="${padY+(height-padY*2)*f}"/>`).join('');
  svg.innerHTML=`<g class="chart-grid">${grid}</g><polygon class="chart-area" points="${area}"/><line class="chart-average" x1="${padX}" x2="${width-padX}" y1="${y(average)}" y2="${y(average)}"/><polyline class="chart-line" points="${points}"/>${values.map((v,i)=>`<circle class="chart-point" cx="${x(i)}" cy="${y(v)}" r="5"/>`).join('')}<text class="chart-label" x="${padX}" y="${Math.max(14,y(average)-8)}">Season ${average.toFixed(2)} FP/G</text><text class="chart-label" x="${width-padX}" y="${height-5}" text-anchor="end">${preview?'Visual preview until game sync':'Most recent games'}</text>`;
}

function renderInsights(player) {
  const s=player.stats||{}; const gp=Math.max(1,player.gamesPlayed);
  const primary = player.playerType==='goalie' ? `${fmt(number(s.saves)/gp,1)} saves per game and ${fmt(player.fpg,2)} fantasy points per appearance.` : `${fmt(number(s.shotsOnGoal)/gp,1)} shots, ${fmt(number(s.hits)/gp,1)} hits and ${fmt(number(s.blocks)/gp,1)} blocks per game.`;
  const special = player.playerType==='goalie' ? `${number(s.wins)} wins and ${number(s.shutouts)} shutouts are included in the current score.` : `${number(s.powerPlayPoints)} power-play points, ${number(s.gameWinningGoals)} game-winners and ${number(s.firstStars)} first-star awards.`;
  const quality = player.dataQuality==='exact' ? 'Every fantasy category is backed by the automated game-event file.' : 'The league-wide NHL reports are live. First stars and event-only categories become exact after the scheduled Gamecenter sync.';
  $('#insightGrid').innerHTML=[['Volume profile',primary],['Bonus production',special],['Data confidence',quality]].map(([title,text])=>`<div class="insight"><strong>${title}</strong><span>${text}</span></div>`).join('');
}

function renderGameLog(player) {
  const games=(player.games||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15);
  $('#gameLogStatus').textContent=games.length?'Exact fantasy game log':'Run automated event sync';
  $('#gameLog').innerHTML=games.length?games.map(game=>`<div class="game-row"><div><small>${formatDate(game.date)}</small><strong>${safeText(game.opponent||game.opponentAbbrev||'NHL')}</strong></div><div><strong>${safeText(game.result||'Completed')}</strong><span class="game-detail">${safeText(game.summary||game.statLine||'Game contribution')}</span></div><span>${fmt(game.fantasyPoints,2)}</span></div>`).join(''):'<div class="empty-state">The live season reports do not include an exact fantasy game log. The included GitHub Action builds this automatically from completed NHL Gamecenter records.</div>';
}

function formatDate(value) { const date=new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime())?String(value||'—'):date.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }

function renderSchedulePlaceholder(player) {
  $('#scheduleList').innerHTML=`<div class="empty-state">Open this tab and press refresh to load ${safeText(player.team)}'s official NHL schedule.</div>`;
}

async function loadSchedule(player) {
  const list=$('#scheduleList'); list.innerHTML='<div class="empty-state">Loading official NHL schedule…</div>';
  const now=new Date();
  const selectedEndYear=Number(state.season.slice(4));
  const seasonForSchedule=now.getFullYear()>=selectedEndYear && now.getMonth()>=5?`${selectedEndYear}${selectedEndYear+1}`:state.season;
  try {
    const data=await fetchJson(`${NHL_WEB}/club-schedule-season/${player.team}/${seasonForSchedule}`);
    const games=(data.games||[]).filter(game=>new Date(`${game.gameDate}T23:59:59`)>=now).slice(0,7);
    list.innerHTML=games.length?games.map(game=>{
      const away=game.awayTeam?.abbrev||game.awayTeam?.placeName?.default||'AWY'; const home=game.homeTeam?.abbrev||game.homeTeam?.placeName?.default||'HOME';
      const opponent=away===player.team?home:away; const location=home===player.team?'vs':'@';
      return `<div class="schedule-row"><div><small>${formatDate(game.gameDate)}</small><strong>${game.startTimeUTC?new Date(game.startTimeUTC).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'TBD'}</strong></div><div class="schedule-team"><img src="${teamLogoUrl(opponent)}" alt=""/><strong>${location} ${safeText(opponent)}</strong></div><span>${game.gameState||'FUT'}</span></div>`;
    }).join(''):`<div class="empty-state">No upcoming ${safeText(player.team)} games were returned for season ${seasonForSchedule.slice(0,4)}–${seasonForSchedule.slice(6)}.</div>`;
    addDiagnostic('NHL club schedule', `${player.team} schedule loaded from the official club-season endpoint.`, 'ok', games.length+' upcoming');
  } catch(error){ list.innerHTML=`<div class="empty-state">Schedule request failed: ${safeText(error.message)}</div>`; addDiagnostic('Schedule request failed',error.message,'warn',player.team); }
}

function renderDraft() {
  state.roster=state.roster.filter(id=>state.players.some(p=>p.id===id)); saveRoster();
  const rosterPlayers=state.roster.map(id=>state.players.find(p=>p.id===id)).filter(Boolean);
  const counts={F:0,D:0,G:0}; rosterPlayers.forEach(p=>counts[positionGroup(p)]++);
  $('#rosterCount').textContent=rosterPlayers.length; $('#rosterF').textContent=`${counts.F} / 12`; $('#rosterD').textContent=`${counts.D} / 8`; $('#rosterG').textContent=`${counts.G} / 3`; $('#rosterFpts').textContent=fmt(rosterPlayers.reduce((s,p)=>s+p.fantasyPoints,0),1);
  const targets={F:12,D:8,G:3};
  $('#rosterSlots').innerHTML=['F','D','G'].map(group=>{
    const players=rosterPlayers.filter(p=>positionGroup(p)===group); const slots=Array.from({length:targets[group]},(_,i)=>players[i]);
    return `<div class="roster-group"><div class="roster-group-title"><strong>${group==='F'?'Forwards':group==='D'?'Defence':'Goalies'}</strong><span>${players.length} / ${targets[group]}</span></div><div class="slot-grid">${slots.map(player=>player?`<div class="roster-slot filled"><img src="${headshotUrl(player)}" alt=""/><div><strong>${safeText(player.name)}</strong><small>${player.team} · ${fmt(player.fpg,2)} FP/G</small></div><button data-remove-roster="${player.id}" aria-label="Remove ${safeText(player.name)}"></button></div>`:`<div class="roster-slot empty">OPEN ${group}</div>`).join('')}</div></div>`;
  }).join('');
  const available=state.players.filter(p=>!state.roster.includes(p.id)&&p.gamesPlayed>=10).slice(0,20);
  $('#draftList').innerHTML=available.map(p=>`<div class="draft-row"><img src="${headshotUrl(p)}" alt="" onerror="this.style.opacity=.15"/><div><strong>${safeText(p.name)}</strong><small>${p.team} · ${p.position} · ${p.gamesPlayed} GP</small></div><div class="draft-score"><b>${fmt(p.fpg,2)}</b><span>${fmt(p.fantasyPoints,1)} FPTS</span></div><button data-add-roster="${p.id}">ADD</button></div>`).join('');
  renderAssistant();
}

function rosterNeed(position='AUTO') {
  const limits={F:12,D:8,G:3}; const counts={F:0,D:0,G:0}; state.roster.map(id=>state.players.find(p=>p.id===id)).filter(Boolean).forEach(p=>counts[positionGroup(p)]++);
  if(position!=='AUTO') return position;
  return Object.keys(limits).sort((a,b)=>(counts[a]/limits[a])-(counts[b]/limits[b]))[0];
}

function findRecommendation() {
  const target=rosterNeed($('#assistantPosition').value); const strategy=$('#assistantStrategy').value;
  const available=state.players.filter(p=>positionGroup(p)===target&&!state.roster.includes(p.id)&&p.gamesPlayed>=8);
  available.sort(strategy==='RECENT'?(a,b)=>b.recentFpg-a.recentFpg||b.fpg-a.fpg:strategy==='BALANCED'?(a,b)=>(b.fpg+b.recentFpg*.25)-(a.fpg+a.recentFpg*.25):(a,b)=>b.fpg-a.fpg);
  return available[0]||null;
}

function renderAssistant(recommended=null) {
  const box=$('#assistantRecommendation');
  if(!recommended){ const need=rosterNeed(); box.innerHTML=`<p>Your largest open roster need is <strong>${need==='F'?'forward':need==='D'?'defence':'goalie'}</strong>. Run the assistant to rank the best undrafted fit using the current scoring rules.</p>`; return; }
  box.innerHTML=`<div class="recommend-player"><img src="${headshotUrl(recommended)}" alt=""/><div><strong>${safeText(recommended.name)}</strong><small>${recommended.team} · ${recommended.position} · ${recommended.gamesPlayed} GP</small><span>${fmt(recommended.fpg,2)} FP/G</span></div></div>`;
}

function renderRules() {
  const renderType=(type,element)=>{ element.innerHTML=Object.entries(state.rules[type]).map(([key,rule])=>`<label class="rule-row"><span><strong>${safeText(rule.label)}</strong><small>${safeText(rule.short)} · raw count × value</small></span><input type="number" step="0.05" data-rule-type="${type}" data-rule-key="${key}" value="${rule.value}"/></label>`).join(''); };
  renderType('skater',$('#skaterRules')); renderType('goalie',$('#goalieRules'));
}

function renderDataMode() {
  const label=state.dataMode==='exact'?'Exact event-synced database: every special category included and all three Fantrax verification players match.':state.dataMode==='synced-unvalidated'?'Game-event database loaded, but at least one verified Fantrax total does not match yet. The data centre shows the warning instead of pretending the totals are exact.':state.dataMode==='live'?'Live NHL season reports: full league loaded; event-only bonuses await the automated Gamecenter sync.':'Offline validation samples: live API was unavailable.';
  $('#dataModeLabel').textContent=label; $('#diagnosticBadge').textContent=state.dataMode.toUpperCase().replaceAll('-',' '); $('#gamecenterState').textContent=state.dataMode==='exact'?'VALIDATED':state.dataMode==='synced-unvalidated'?'AUDIT':'SYNC FILE';
  $('#metricExact').textContent=state.players.filter(p=>p.dataQuality==='exact').length.toLocaleString('en-US');
}

function renderDiagnostics() {
  const list=$('#diagnosticList'); if(!list)return;
  list.innerHTML=state.diagnostics.slice().reverse().map(item=>`<div class="diagnostic-row"><i class="${item.status==='warn'?'warn':item.status==='error'?'error':''}"></i><div><strong>${safeText(item.title)}</strong><small>${safeText(item.detail)}</small></div><span>${safeText(item.value)}</span></div>`).join('')||'<div class="empty-state">No import attempts yet.</div>';
}

function navigate(route) {
  state.route=route;
  $$('.page').forEach(page=>page.classList.toggle('active',page.id===`page-${route}`));
  $$('[data-route]').forEach(button=>button.classList.toggle('active',button.dataset.route===route&&(button.classList.contains('nav-link')||button.classList.contains('mobile-link'))));
  window.scrollTo({top:0,behavior:'smooth'});
  if(route==='lab')renderLab(); if(route==='draft')renderDraft();
}

function openPlayer(id) { state.selectedPlayerId=number(id); navigate('lab'); renderLab(); }
function showDialog(title,body,eyebrow='FDA'){ $('#dialogTitle').textContent=title; $('#dialogEyebrow').textContent=eyebrow; $('#dialogBody').innerHTML=body; $('#messageDialog').showModal(); }

function bindEvents() {
  document.addEventListener('click',event=>{
    const route=event.target.closest('[data-route]')?.dataset.route; if(route)navigate(route);
    const playerId=event.target.closest('[data-open-player]')?.dataset.openPlayer; if(playerId)openPlayer(playerId);
    const addId=event.target.closest('[data-add-roster]')?.dataset.addRoster; if(addId){ if(state.roster.length>=23)return showDialog('Roster full','<p>The current roster plan contains 23 players. Remove one before adding another.</p>'); if(!state.roster.includes(number(addId)))state.roster.push(number(addId));saveRoster();renderDraft(); }
    const removeId=event.target.closest('[data-remove-roster]')?.dataset.removeRoster; if(removeId){state.roster=state.roster.filter(id=>id!==number(removeId));saveRoster();renderDraft();}
  });
  $('#refreshData').addEventListener('click',()=>refreshAllData({forceLive:true}));
  $('#dataRefreshButton').addEventListener('click',()=>refreshAllData({forceLive:true}));
  $('#seasonSelect').addEventListener('change',event=>{state.season=event.target.value;refreshAllData();});
  ['playerSearch','positionFilter','teamFilter','sortFilter'].forEach(id=>$('#'+id).addEventListener(id==='playerSearch'?'input':'change',()=>{state.visibleCount=60;applyPlayerFilters();}));
  $('#clearSearch').addEventListener('click',()=>{$('#playerSearch').value='';applyPlayerFilters();});
  $('#loadMore').addEventListener('click',()=>{state.visibleCount+=60;renderPlayers();});
  $$('.lab-tab').forEach(button=>button.addEventListener('click',()=>{$$('.lab-tab').forEach(x=>x.classList.remove('active'));button.classList.add('active');$$('.lab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`lab-${button.dataset.labtab}`));}));
  $('#watchPlayer').addEventListener('click',()=>{const player=selectedPlayer();if(!player)return;state.watchlist.has(player.id)?state.watchlist.delete(player.id):state.watchlist.add(player.id);storage.setItem('fda-watchlist',JSON.stringify([...state.watchlist]));renderLab();});
  $('#refreshSchedule').addEventListener('click',()=>{const player=selectedPlayer();if(player)loadSchedule(player);});
  $('#runAssistant').addEventListener('click',()=>renderAssistant(findRecommendation()));
  $('#resetRoster').addEventListener('click',()=>{state.roster=[];saveRoster();renderDraft();});
  $('#restoreRules').addEventListener('click',()=>{state.rules=structuredClone(DEFAULT_RULES);saveRules();recalculateAll();});
  document.addEventListener('input',event=>{const input=event.target.closest('[data-rule-key]');if(!input)return;state.rules[input.dataset.ruleType][input.dataset.ruleKey].value=number(input.value);saveRules();state.players=state.players.map(calculatePlayer);renderDashboard();applyPlayerFilters();renderLab();renderDraft();});
  $('#closeDialog').addEventListener('click',()=>$('#messageDialog').close());
}

bindEvents();
if (OFFLINE_PREVIEW) {
  state.dataMode = 'offline';
  state.players = OFFLINE_VALIDATION.map(calculatePlayer);
  state.metadata = { generatedAt: new Date().toISOString(), source: 'Offline validation preview' };
  addDiagnostic('Offline preview mode', 'Network requests were skipped so the layout can be inspected locally.', 'warn', '3 samples');
  setLiveStatus('error', 'Offline layout preview · live GitHub build uses NHL APIs');
  recalculateAll();
} else {
  refreshAllData();
}
