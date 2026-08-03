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

const ACTIVE_ROSTER_TARGETS = { F:12, D:8, G:3 };
const NIGHTLY_LIMITS = { F:6, D:4, G:2 };
const NHL_SALARY_CAP = 104000000;
const NHL_LEAGUE_MINIMUM = 850000;
const CALENDAR_LOW_CAP_MAX = 3000000;
const DEFAULT_UNSIGNED_ESTIMATES = { adamfantilli:12000000 };
const BUDGET_PLAN_DEFINITIONS = {
  minimum:{ label:'Maximum flexibility', description:'Every empty slot stays at league minimum so the unassigned reserve is completely visible.' },
  balanced:{ label:'Balanced roster', description:'The remaining cap is spread across every open slot with a small forward premium.' },
  starters:{ label:'Nightly starters', description:'Extra cap is concentrated into vacancies inside the 6F / 4D / 2G nightly lineup.' },
  oneStar:{ label:'One superstar', description:'One open roster spot receives the largest possible premium while every other opening stays at minimum.' },
  twoStars:{ label:'Two premium players', description:'Two open spots split the available premium while the rest remain minimum-priced.' },
  forwards:{ label:'Forward heavy', description:'Most of the available upgrade money is directed toward open forward positions.' },
  defence:{ label:'Defence heavy', description:'Most of the available upgrade money is directed toward open defence positions.' },
  goalies:{ label:'Goalie premium', description:'A larger share of the remaining cap is reserved for the open goalie position.' },
  depth:{ label:'Mid-tier depth', description:'Every opening is budgeted up to $4 million and any surplus stays unassigned for later moves.' }
};
const KEEPER_SEED_VERSION = '2026-07-28-v1';
const KEEPER_SEED = [
  { id:-9001, name:'Matvei Michkov', team:'PHI', position:'F' },
  { id:-9002, name:'Leo Carlsson', team:'ANA', position:'F' },
  { id:-9003, name:'Adam Fantilli', team:'CBJ', position:'F' },
  { id:-9004, name:'Michael Misa', team:'SJS', position:'F' },
  { id:-9005, name:'Sam Dickinson', team:'SJS', position:'D' },
  { id:-9006, name:'Noah Dobson', team:'MTL', position:'D' },
  { id:-9007, name:'Quinn Hughes', team:'MIN', position:'D' },
  { id:-9008, name:'Charlie McAvoy', team:'BOS', position:'D' },
  { id:-9009, name:'Yaroslav Askarov', team:'SJS', position:'G' },
  { id:-9010, name:'Mackenzie Blackwood', team:'COL', position:'G' },
  { id:-9011, name:'James Hagens', team:'BOS', position:'F', minor:true },
  { id:-9012, name:'Ilya Protas', team:'WSH', position:'F', minor:true }
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
  edgeCache: new Map(),
  edgeLoading: new Set(),
  calendar: {
    season: '20262027', data: null, status: 'idle', error: '',
    window: 'FULL', threshold: 8, focusTeam: 'ALL', sort: 'score', lookupTeam: storage.getItem('fda-calendar-lookup-team') || 'ANA',
    pairs: [], trios: [], selectedPair: null, visiblePairs: 30, weekIndex: 0, teamPlans: [], generatorStatus:'idle', generatorError:''
  },
  history: { status: 'idle', data: null, error: '', tab: 'career', detailCache: new Map(), fantasySeason:'20252026', fantasyPosition:'ALL', fantasyStatus:'idle', fantasyError:'', fantasyCache:new Map() },
  salary: {
    status:'idle', error:'', source:'', records:[], metadata:{}, index:new Map(), namePositionIndex:new Map(),
    plan:storage.getItem('fda-budget-plan') || 'minimum',
    estimates:loadSalaryEstimates(),
    corrections:loadSalaryCorrections(),
    predictions:loadPlayerPredictions(),
    slotOverrides:loadSlotBudgetOverrides(),
    selectedSlot:null, editorPlayerId:null, editorSearch:'',
    recommendationSort:storage.getItem('fda-recommendation-sort') || 'FPG',
    draftSearch:'', draftPosition:'ALL', draftSort:'FPG', draftFitsSlot:false
  },
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

function loadSalaryEstimates() {
  try { return { ...DEFAULT_UNSIGNED_ESTIMATES, ...JSON.parse(storage.getItem('fda-salary-estimates') || '{}') }; }
  catch { return { ...DEFAULT_UNSIGNED_ESTIMATES }; }
}
function loadSlotBudgetOverrides() {
  try { return JSON.parse(storage.getItem('fda-slot-budget-overrides') || '{}'); }
  catch { return {}; }
}
function loadSalaryCorrections() {
  try { return JSON.parse(storage.getItem('fda-salary-corrections') || '{}'); }
  catch { return {}; }
}
function loadPlayerPredictions() {
  try { return JSON.parse(storage.getItem('fda-player-predictions') || '{}'); }
  catch { return {}; }
}
function savePlayerOverrides() {
  storage.setItem('fda-salary-corrections',JSON.stringify(state.salary.corrections));
  storage.setItem('fda-player-predictions',JSON.stringify(state.salary.predictions));
}
function saveSalarySettings() {
  storage.setItem('fda-budget-plan',state.salary.plan);
  storage.setItem('fda-salary-estimates',JSON.stringify(state.salary.estimates));
  storage.setItem('fda-slot-budget-overrides',JSON.stringify(state.salary.slotOverrides));
  storage.setItem('fda-recommendation-sort',state.salary.recommendationSort);
}
function money(value, compact=false) {
  const amount=number(value);
  if(compact&&Math.abs(amount)>=1000000)return `$${(amount/1000000).toLocaleString('en-US',{minimumFractionDigits:amount%1000000?1:0,maximumFractionDigits:2})}M`;
  if(compact&&Math.abs(amount)>=1000)return `$${(amount/1000).toLocaleString('en-US',{maximumFractionDigits:0})}K`;
  return amount.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
}
function normalizeTeamCode(value) {
  const team=String(value||'').trim().toUpperCase();
  return ({NAS:'NSH',WAS:'WSH'}[team]||team);
}
function salaryName(value) {
  const raw=String(value||'').trim();
  if(raw.includes(',')){const [last,...rest]=raw.split(',');return `${rest.join(',').trim()} ${last.trim()}`.trim();}
  return raw;
}
function salaryPosition(value) {
  const position=String(value||'').toUpperCase();
  if(position==='G'||position.includes('GOAL'))return 'G';
  if(position==='D'||position==='LD'||position==='RD'||position.includes('DEF'))return 'D';
  return 'F';
}
function salaryKey(name,team,position) { return `${normalizeTeamCode(team)}|${normalizedName(salaryName(name))}|${salaryPosition(position)}`; }
function salaryNamePositionKey(name,position) { return `${normalizedName(salaryName(name))}|${salaryPosition(position)}`; }
function playerEstimateKey(player) { return normalizedName(player?.name); }
function normalizeSalaryRecord(row) {
  const name=row.player??row.Player??row.name??row.Name??row.fullName??'';
  const team=row.team??row.Team??row.teamAbbrev??row.teamCode??'';
  const position=row.position??row.Position??row.pos??'';
  const salary=number(row.salary??row.capHit??row['2026-27 Salary']??row.aav??0);
  const rosterStatus=row.rosterStatus??row['Roster Status']??row.status??'';
  return { name:salaryName(name), nameKey:normalizedName(row.nameKey||name), team:normalizeTeamCode(team), position:salaryPosition(position), salary, salaryState:String(row.salaryState||'').toLowerCase(), rosterStatus:String(rosterStatus||''), raw:row };
}
function salaryRowsFromPayload(payload) {
  if(Array.isArray(payload))return payload;
  for(const key of ['records','players','salaries','data'])if(Array.isArray(payload?.[key]))return payload[key];
  return [];
}
function parseCsvRows(text) {
  const rows=[]; let row=[]; let field=''; let quoted=false;
  for(let index=0;index<text.length;index++){
    const char=text[index];
    if(quoted){
      if(char==='"'&&text[index+1]==='"'){field+='"';index++;}
      else if(char==='"')quoted=false;
      else field+=char;
    } else if(char==='"')quoted=true;
    else if(char===','){row.push(field);field='';}
    else if(char==='\n'){row.push(field);rows.push(row);row=[];field='';}
    else if(char!=='\r')field+=char;
  }
  if(field||row.length){row.push(field);rows.push(row);}
  const header=(rows.shift()||[]).map(value=>String(value).trim());
  return rows.filter(values=>values.some(value=>String(value).trim())).map(values=>Object.fromEntries(header.map((key,index)=>[key,values[index]??''])));
}
function rebuildSalaryIndex() {
  state.salary.index=new Map();
  state.salary.namePositionIndex=new Map();
  for(const record of state.salary.records){
    state.salary.index.set(salaryKey(record.name,record.team,record.position),record);
    state.salary.namePositionIndex.set(salaryNamePositionKey(record.nameKey||record.name,record.position),record);
  }
}
function playerDataKey(player) { return salaryKey(player?.name,player?.team,positionGroup(player)); }
function storedPlayerOverride(store,player) {
  const exact=store[playerDataKey(player)];
  if(exact!==undefined)return exact;
  const suffix=`|${normalizedName(player?.name)}|${positionGroup(player)}`;
  const fallback=Object.entries(store).find(([key])=>key.endsWith(suffix));
  return fallback?fallback[1]:undefined;
}
function salaryCorrectionFor(player) {
  const value=storedPlayerOverride(state.salary.corrections,player);
  return value===undefined?null:number(value);
}
function predictionForPlayer(player) {
  const value=number(storedPlayerOverride(state.salary.predictions,player));
  return value>0?value:null;
}
function playerRankingFpg(player) { return predictionForPlayer(player) ?? number(player?.fpg); }
function findSalaryRecord(player) {
  const key=playerDataKey(player);
  const base=state.salary.index.get(key) || state.salary.namePositionIndex.get(salaryNamePositionKey(player?.name,positionGroup(player))) || null;
  const correction=salaryCorrectionFor(player);
  if(correction===null)return base;
  return { ...(base||{name:player.name,team:normalizeTeamCode(player.team),position:positionGroup(player),rosterStatus:'Nick update'}), salary:correction, corrected:true };
}
function applySalaryDataToPlayers() {
  state.players=state.players.map(player=>{
    const record=findSalaryRecord(player);
    const predictionFpg=predictionForPlayer(player);
    if(!record)return { ...player, capHit:null, salaryStatus:'missing', salaryRecord:null, salaryCorrected:false, predictionFpg };
    return { ...player, team:record.team||player.team, capHit:record.salary>0?record.salary:null, salaryStatus:record.salary>0?'signed':'unsigned', salaryRecord:record, salaryCorrected:Boolean(record.corrected), predictionFpg };
  });
}
function ensureSalaryMasterPlayers() {
  if(!state.salary.records.length)return;
  const existing=new Set(state.players.map(player=>salaryNamePositionKey(player.name,positionGroup(player))));
  for(const [recordIndex,record] of state.salary.records.entries()){
    const key=salaryNamePositionKey(record.name,record.position);
    if(existing.has(key))continue;
    const salaryOnlyId=-300000-recordIndex;
    state.players.push(calculatePlayer({
      id:salaryOnlyId, name:record.name, team:record.team, position:record.position,
      playerType:record.position==='G'?'goalie':'skater', gamesPlayed:0,
      stats:blankPlayerStats(), games:[], currentRoster:record.rosterStatus==='Active roster',
      dataQuality:'salary-master-only', salaryOnly:true
    }));
    existing.add(key);
  }
}
async function loadSalaryData({ force=false }={}) {
  if(state.salary.status==='loading')return;
  if(!force&&state.salary.records.length)return;
  state.salary.status='loading'; state.salary.error='';
  try {
    const response=await fetch(`data/SALARY_CAP_SPACE.json?t=${Date.now()}`,{cache:'no-store'});
    if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
    const payload=await response.json();
    const rows=salaryRowsFromPayload(payload);
    if(!rows.length)throw new Error('The packaged salary reference contains no player records.');
    state.salary.records=rows.map(normalizeSalaryRecord).filter(row=>row.name&&row.team);
    state.salary.metadata={...payload,...(payload.metadata||{})};
    state.salary.source=payload.source||payload.sourceMethod||payload.sourceFile||state.salary.metadata.source||'Packaged 2026-27 salary reference';
    state.salary.status='ready';
    rebuildSalaryIndex();
    addDiagnostic('Packaged salary file',`${state.salary.records.length} salary records loaded directly from data/SALARY_CAP_SPACE.json.`,'ok',`${state.salary.records.length} records`);
  } catch(error) {
    state.salary.status='error'; state.salary.error=error.message; state.salary.records=[]; state.salary.index=new Map(); state.salary.namePositionIndex=new Map();
    addDiagnostic('Packaged salary file unavailable',error.message,'warn','Cap estimates only');
  }
}
function normalizedName(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,''); }
function rosterPlayers() { return state.roster.map(id=>state.players.find(player=>player.id===id)).filter(Boolean); }
function activeRosterPlayers() { return rosterPlayers().filter(player=>!player.minorKeeper); }
function minorRosterPlayers() { return rosterPlayers().filter(player=>player.minorKeeper); }
function activeRosterCount() { return activeRosterPlayers().length; }
function keeperIds() { return state.players.filter(player=>player.keeper).map(player=>player.id); }

function ensureKeeperPlayers() {
  const byName = new Map(state.players.map(player=>[normalizedName(player.name),player]));
  for (const seed of KEEPER_SEED) {
    const existing = byName.get(normalizedName(seed.name));
    if (existing) {
      existing.keeper = true;
      existing.minorKeeper = Boolean(seed.minor);
      existing.rosterRole = seed.minor ? 'minor' : 'keeper';
      existing.team = existing.team && existing.team !== 'NHL' ? existing.team : seed.team;
      existing.position = seed.position;
      existing.playerType = seed.position === 'G' ? 'goalie' : 'skater';
      continue;
    }
    const player = calculatePlayer({
      ...seed,
      playerType:seed.position==='G'?'goalie':'skater', gamesPlayed:0,
      stats:blankPlayerStats(), currentRoster:true, dataQuality:'keeper-seed',
      keeper:true, minorKeeper:Boolean(seed.minor), rosterRole:seed.minor?'minor':'keeper'
    });
    state.players.push(player);
    byName.set(normalizedName(seed.name),player);
  }
}

function seedKeeperRoster({ force=false } = {}) {
  const version = storage.getItem('fda-keeper-seed-version');
  const mandatory = keeperIds();
  if (!force && version === KEEPER_SEED_VERSION && mandatory.every(id=>state.roster.includes(id))) return;
  const validExisting = state.roster.filter(id=>state.players.some(player=>player.id===id && !player.keeper));
  state.roster = [...new Set([...mandatory,...validExisting])];
  storage.setItem('fda-keeper-seed-version',KEEPER_SEED_VERSION);
  saveRoster();
}

function restoreKeeperRoster() {
  state.roster = keeperIds();
  storage.setItem('fda-keeper-seed-version',KEEPER_SEED_VERSION);
  saveRoster();
}

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
  if (number(player.id) < 0) return teamLogoUrl(player.team);
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



const NHL_TEAMS = ['ANA','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET','EDM','FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK','WPG','WSH'];

function rosterName(row) {
  const first = row?.firstName?.default || row?.firstName?.en || '';
  const last = row?.lastName?.default || row?.lastName?.en || '';
  return `${first} ${last}`.trim() || row?.fullName?.default || row?.fullName || `Player ${row?.id || ''}`;
}

function normalizeRosterPosition(position, type) {
  if (type === 'goalie' || position === 'G') return 'G';
  if (['D','LD','RD'].includes(String(position || '').toUpperCase())) return 'D';
  return String(position || 'F').toUpperCase();
}

function blankPlayerStats() {
  return { goals:0, assists:0, shotsOnGoal:0, hits:0, blocks:0, faceoffsWon:0, faceoffsLost:0, powerPlayPoints:0, shortHandedPoints:0, gameWinningGoals:0, minorPenalties:0, fights:0, shootoutGoals:0, hatTricks:0, gordieHoweHatTricks:0, firstStars:0, saves:0, goalsAgainst:0, wins:0, shutouts:0 };
}

function mergeDirectoryPlayers(rosterPlayers, seasonPlayers) {
  const byId = new Map();
  const merge = player => {
    const id = number(player.id || player.playerId);
    if (!id) return;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...player, id, stats:{ ...blankPlayerStats(), ...(player.stats || {}) } });
      return;
    }
    const nextHasStats = number(player.gamesPlayed) > 0;
    byId.set(id, {
      ...existing,
      ...player,
      id,
      name: player.name && !String(player.name).startsWith('Player ') ? player.name : existing.name,
      team: nextHasStats ? (player.team || existing.team) : (existing.team || player.team),
      position: existing.position && existing.position !== 'F' ? existing.position : player.position,
      playerType: existing.playerType === 'goalie' || player.playerType === 'goalie' ? 'goalie' : 'skater',
      headshot: existing.headshot || player.headshot || null,
      currentRoster: Boolean(existing.currentRoster || player.currentRoster),
      gamesPlayed: Math.max(number(existing.gamesPlayed), number(player.gamesPlayed)),
      stats: nextHasStats ? { ...blankPlayerStats(), ...(existing.stats || {}), ...(player.stats || {}) } : { ...blankPlayerStats(), ...(player.stats || {}), ...(existing.stats || {}) },
      dataQuality: nextHasStats ? (player.dataQuality || existing.dataQuality) : existing.dataQuality
    });
  };
  rosterPlayers.forEach(merge);
  seasonPlayers.forEach(merge);
  return [...byId.values()].map(calculatePlayer);
}

async function loadServerPlayerDirectory() {
  try {
    const response = await fetch(`/api/players?season=${encodeURIComponent(state.season)}&t=${Date.now()}`, { cache:'no-store' });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json();
    if (!Array.isArray(payload.players) || payload.players.length < 300) throw new Error(`Only ${payload.players?.length || 0} player records returned.`);
    state.players = payload.players.map(normalizeSyncedPlayer);
    state.metadata = { ...(payload.metadata || {}), generatedAt:payload.generatedAt || payload.metadata?.generatedAt || new Date().toISOString() };
    state.dataMode = 'official-directory';
    addDiagnostic('Complete NHL player directory', `${state.players.length} current-roster and season player records loaded through the Vercel server route.`, 'ok', `${state.players.length} players`);
    if (payload.metadata?.failedRosterTeams?.length) addDiagnostic('Roster endpoint warnings', `${payload.metadata.failedRosterTeams.length} team roster requests failed and will retry on refresh.`, 'warn', 'Partial roster');
    if (payload.metadata?.reportErrors?.length) addDiagnostic('Season report warnings', payload.metadata.reportErrors.join(' | '), 'warn', 'Partial stats');
    return true;
  } catch (error) {
    addDiagnostic('Vercel player-directory route', `Server route unavailable in this preview: ${error.message}`, 'warn', 'Direct NHL fallback');
    return false;
  }
}

async function loadBrowserRosterDirectory() {
  const results = await Promise.allSettled(NHL_TEAMS.map(async team => ({ team, payload:await fetchJson(`${NHL_WEB}/roster/${team}/current`, { timeout:12000, retries:1 }) })));
  const rosterPlayers = [];
  let successfulTeams = 0;
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    successfulTeams++;
    const { team, payload } = result.value;
    const addRows = (rows, fallbackPosition, playerType) => {
      for (const row of rows || []) {
        const id = number(row.id || row.playerId);
        if (!id) continue;
        rosterPlayers.push({
          id,
          name:rosterName(row),
          team,
          position:normalizeRosterPosition(row.positionCode || row.position || fallbackPosition, playerType),
          playerType,
          gamesPlayed:0,
          stats:blankPlayerStats(),
          currentRoster:true,
          headshot:row.headshot || null,
          sweaterNumber:row.sweaterNumber ?? null,
          shootsCatches:row.shootsCatches || null,
          birthDate:row.birthDate || null,
          heightInInches:number(row.heightInInches) || null,
          weightInPounds:number(row.weightInPounds) || null,
          dataQuality:'official-roster'
        });
      }
    };
    addRows(payload.forwards,'F','skater');
    addRows(payload.defensemen || payload.defencemen,'D','skater');
    addRows(payload.goalies,'G','goalie');
  }
  if (rosterPlayers.length < 300) throw new Error(`Only ${rosterPlayers.length} roster records from ${successfulTeams}/32 teams.`);
  addDiagnostic('Official NHL team rosters', `${rosterPlayers.length} current roster players received from ${successfulTeams}/32 teams.`, successfulTeams === 32 ? 'ok' : 'warn', `${rosterPlayers.length} players`);
  return rosterPlayers;
}

async function loadLiveReports() {
  state.dataMode = 'live';
  let rosterPlayers = [];
  try { rosterPlayers = await loadBrowserRosterDirectory(); }
  catch (error) { addDiagnostic('NHL roster directory failed', error.message, 'warn', 'Season players only'); }
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
  if (!maps.summary?.size && !rosterPlayers.length) throw new Error('Neither the NHL roster directory nor skater season report returned player records.');

  const skaters = [...(maps.summary?.values() || [])].map(summary => {
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

  state.players = mergeDirectoryPlayers(rosterPlayers, [...skaters, ...goalies]).filter(player => player.id);
  if (state.players.length < 300) throw new Error(`Only ${state.players.length} NHL players were assembled; refusing to show a sample as the full pool.`);
  state.metadata = { generatedAt: new Date().toISOString(), source: 'Official NHL current rosters plus Stats REST reports', reportCount: successful, currentRosterCount:rosterPlayers.length };
  addDiagnostic('Fantasy calculation', 'Raw report categories were joined by NHL player ID and your scoring formula was applied.', 'ok', 'Derived');
}

async function refreshAllData({ forceLive = false } = {}) {
  state.diagnostics = [];
  state.players = [];
  setLiveStatus('loading', 'Connecting to NHL data…');
  renderLoadingPlayers();
  try {
    const exact = forceLive ? false : await loadSyncedData();
    if (!exact) {
      const directoryLoaded = await loadServerPlayerDirectory();
      if (!directoryLoaded) await loadLiveReports();
    }
    ensureKeeperPlayers();
    await loadSalaryData({force:forceLive});
    ensureSalaryMasterPlayers();
    applySalaryDataToPlayers();
    seedKeeperRoster();
    recalculateAll();
    setLiveStatus(state.dataMode === 'synced-unvalidated' ? 'error' : 'live', state.dataMode === 'exact' ? 'Exact game-event database loaded · Fantrax validation passed' : state.dataMode === 'synced-unvalidated' ? 'Game-event sync loaded · Fantrax validation needs review' : `Official NHL player directory loaded · ${state.players.length} players`);
  } catch (error) {
    state.dataMode = 'error';
    state.players = [];
    state.metadata = { generatedAt:new Date().toISOString(), source:'No complete source loaded' };
    addDiagnostic('Complete NHL import unavailable', error.message, 'error', 'No sample substitution');
    setLiveStatus('error', 'Complete NHL directory unavailable · keeper roster remains available');
    ensureKeeperPlayers();
    await loadSalaryData({force:forceLive});
    ensureSalaryMasterPlayers();
    applySalaryDataToPlayers();
    seedKeeperRoster();
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
  renderCalendar();
  renderHistory();
  renderDataMode();
  renderDiagnostics();
}

function renderDashboard() {
  $('#metricPlayers').textContent = state.players.length.toLocaleString('en-US');
  $('#metricExact').textContent = state.players.filter(p => p.dataQuality === 'exact').length.toLocaleString('en-US');
  const generated = state.metadata?.generatedAt ? new Date(state.metadata.generatedAt) : null;
  $('#metricFreshness').textContent = generated && !Number.isNaN(generated.getTime()) ? generated.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Live';
  $('#metricFreshnessSub').textContent = state.dataMode === 'exact' ? 'Validated event sync' : state.dataMode === 'synced-unvalidated' ? 'Event sync · audit warning' : state.dataMode === 'live' || state.dataMode === 'official-directory' ? 'Official NHL directory' : 'Source unavailable';
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
        <small>${safeText(player.team)} · ${safeText(player.position)} · ${player.dataQuality === 'exact' ? 'Exact game sync' : player.dataQuality === 'official-roster' ? 'Official NHL current roster' : player.dataQuality === 'event-sync-unvalidated' ? 'Game sync · validation warning' : 'Official NHL season reports'}</small>
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
  $('#labDataQuality').textContent = player.dataQuality === 'exact' ? 'Exact game-event sync · Fantrax validation passed' : player.dataQuality === 'event-sync-unvalidated' ? 'Game-event sync loaded · validation mismatch under audit' : player.dataQuality === 'official-roster' ? 'Official NHL roster · no season games yet' : 'Official NHL season reports · special events pending';
  $('#labFpts').textContent = fmt(player.fantasyPoints,2); $('#labFpg').textContent = fmt(player.fpg,2); $('#labFpgExact').textContent = player.dataQuality === 'exact' ? `${player.fpg.toFixed(4)} exact` : player.gamesPlayed ? `${player.fpg.toFixed(4)} before event sync` : 'No NHL games';
  $('#labRecent').textContent = player.recentGames ? fmt(player.recentFpg,2) : '—'; $('#labRecentGames').textContent = player.recentGames ? `${player.recentGames} games in 7 days` : 'Game-event sync required';
  const trendLabel = player.trend === 'up' ? 'RISING' : player.trend === 'down' ? 'FALLING' : 'HOLD';
  const trendClass = player.trend === 'up' ? 'trend-up' : player.trend === 'down' ? 'trend-down' : 'trend-flat';
  $('#labTrend').textContent = trendLabel; $('#labTrend').className = trendClass;
  $('#labTrendReason').textContent = player.recentGames < 2 ? 'Waiting for recent game sample' : `${player.trendDelta >= 0 ? '+' : ''}${fmt(player.trendDelta,2)} vs season FP/G`;
  $('#watchPlayer').classList.toggle('active',state.watchlist.has(player.id));
  renderRawStats(player); renderAudit(player); renderTrendChart(player); renderInsights(player); renderGameLog(player); renderSchedulePlaceholder(player); renderEdgePanel(player);
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



function readableMetricKey(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
}

function edgeMetricValue(value, key = '') {
  const n = number(value);
  if (/percent|pct|percentage/i.test(key)) return `${n.toFixed(1)}%`;
  if (/speed|mph/i.test(key)) return `${n.toFixed(2)} mph`;
  if (/distance|miles/i.test(key)) return `${n.toFixed(2)} mi`;
  return Math.abs(n) >= 100 ? n.toLocaleString('en-US',{maximumFractionDigits:1}) : n.toLocaleString('en-US',{maximumFractionDigits:2});
}

function renderEdgePanel(player) {
  const cached = state.edgeCache.get(`${state.season}:${player.id}`);
  const status = $('#edgeStatus');
  const metrics = $('#edgeMetrics');
  const raw = $('#edgeRaw');
  if (!cached) {
    status.className = 'edge-status';
    status.textContent = player.gamesPlayed ? `NHL EDGE is ready for ${player.name}. Data loads on demand.` : `${player.name} has no NHL game sample for this season, so EDGE may not have tracking data.`;
    metrics.innerHTML = '';
    raw.innerHTML = '';
    $('#edgeDetails').open = false;
    return;
  }
  if (cached.error) {
    status.className = 'edge-status error';
    status.textContent = cached.error;
    metrics.innerHTML = '';
    raw.innerHTML = '';
    return;
  }
  status.className = 'edge-status live';
  status.textContent = `${cached.metrics?.length || 0} advanced metrics loaded from official NHL EDGE for ${player.name}.`;
  metrics.innerHTML = (cached.metrics || []).slice(0,24).map(metric => `<article class="edge-metric"><small>${safeText(metric.section || 'NHL EDGE')}</small><strong>${safeText(edgeMetricValue(metric.value,metric.key))}</strong><span title="${safeText(metric.key)}">${safeText(readableMetricKey(metric.key))}</span></article>`).join('') || '<div class="empty-state">The endpoint returned data, but no numeric metrics could be summarized automatically. Open the raw sections below.</div>';
  raw.innerHTML = (cached.sections || []).map(section => `<div class="edge-raw-section"><strong>${safeText(section.label || section.key)}</strong><pre>${safeText(JSON.stringify(section.data,null,2))}</pre></div>`).join('');
}

function flattenEdgeNumbers(value, prefix = '', output = [], depth = 0) {
  if (depth > 5 || output.length >= 80 || value == null) return output;
  if ((typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))) {
    output.push({ key:prefix, value:Number(value) });
    return output;
  }
  if (Array.isArray(value)) {
    value.slice(0,12).forEach((item,index)=>flattenEdgeNumbers(item,`${prefix}${prefix?'.':''}${index}`,output,depth+1));
    return output;
  }
  if (typeof value === 'object') for (const [key,child] of Object.entries(value)) {
    flattenEdgeNumbers(child,`${prefix}${prefix?'.':''}${key}`,output,depth+1);
    if (output.length >= 80) break;
  }
  return output;
}

function summarizeEdgeSections(sections) {
  const preferred=/(max|avg|average|percent|pct|bursts|distance|miles|speed|offensive|neutral|defensive|danger|shots|goals|save)/i;
  const metrics=[]; const seen=new Set();
  for(const section of sections) for(const metric of flattenEdgeNumbers(section.data)) {
    if(!metric.key||!preferred.test(metric.key)) continue;
    const key=metric.key.split('.').filter(part=>!/^\d+$/.test(part)).slice(-3).join(' · ');
    const signature=`${section.key}:${key}`; if(seen.has(signature))continue; seen.add(signature);
    metrics.push({section:section.label,key,value:metric.value}); if(metrics.length>=30)return metrics;
  }
  return metrics;
}

async function loadEdgeDataForPlayer(player) {
  const cacheKey=`${state.season}:${player.id}`;
  if(state.edgeLoading.has(cacheKey))return;
  state.edgeLoading.add(cacheKey);
  $('#edgeStatus').className='edge-status'; $('#edgeStatus').textContent=`Loading NHL EDGE for ${player.name}…`; $('#edgeMetrics').innerHTML='<div class="empty-state">Contacting official NHL EDGE endpoints…</div>';
  try {
    let payload;
    try {
      const response=await fetch(`/api/edge?playerId=${player.id}&season=${state.season}&position=${encodeURIComponent(player.position)}`,{cache:'no-store'});
      if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
      payload=await response.json();
    } catch(serverError) {
      const definitions=player.position==='G'
        ? [{key:'goalie',label:'Goalie tracking',url:`${NHL_WEB}/edge/goalie-detail/${player.id}/${state.season}/2`}]
        : [
          {key:'overview',label:'EDGE overview',url:`${NHL_WEB}/cat/edge/skater-detail/${player.id}/${state.season}/2`},
          {key:'skatingSpeed',label:'Skating speed',url:`${NHL_WEB}/edge/skater-skating-speed-detail/${player.id}/${state.season}/2`},
          {key:'skatingDistance',label:'Skating distance',url:`${NHL_WEB}/edge/skater-skating-distance-detail/${player.id}/${state.season}/2`},
          {key:'shotSpeed',label:'Shot speed',url:`${NHL_WEB}/edge/skater-shot-speed-detail/${player.id}/${state.season}/2`},
          {key:'shotLocation',label:'Shot location',url:`${NHL_WEB}/edge/skater-shot-location-detail/${player.id}/${state.season}/2`},
          {key:'zoneTime',label:'Zone time',url:`${NHL_WEB}/edge/skater-zone-time/${player.id}/${state.season}/2`}
        ];
      const results=await Promise.allSettled(definitions.map(async definition=>({...definition,data:await fetchJson(definition.url,{timeout:15000,retries:1})})));
      const sections=results.filter(result=>result.status==='fulfilled').map(result=>({key:result.value.key,label:result.value.label,data:result.value.data}));
      if(!sections.length)throw serverError;
      payload={source:'NHL EDGE direct browser fallback',sections,metrics:summarizeEdgeSections(sections),errors:results.filter(result=>result.status==='rejected').map(result=>result.reason?.message||'Unavailable')};
    }
    state.edgeCache.set(cacheKey,payload); addDiagnostic('NHL EDGE player data',`${payload.sections?.length||0} EDGE sections loaded for ${player.name}.`,'ok',`${payload.metrics?.length||0} metrics`);
  } catch(error) {
    state.edgeCache.set(cacheKey,{error:`NHL EDGE could not load for ${player.name}: ${error.message}`}); addDiagnostic('NHL EDGE request failed',error.message,'warn',player.name);
  } finally {
    state.edgeLoading.delete(cacheKey); renderEdgePanel(player);
  }
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

function planningSalaryForPlayer(player) {
  if(number(player?.capHit)>0)return number(player.capHit);
  const saved=number(state.salary.estimates[playerEstimateKey(player)]);
  return saved>0?saved:NHL_LEAGUE_MINIMUM;
}
function rosterCapSummary(players=activeRosterPlayers()) {
  const signed=players.filter(player=>number(player.capHit)>0).reduce((sum,player)=>sum+number(player.capHit),0);
  const unresolved=players.filter(player=>!number(player.capHit));
  const estimates=unresolved.reduce((sum,player)=>sum+planningSalaryForPlayer(player),0);
  const planned=signed+estimates;
  return { signed, unresolved, estimates, planned, remaining:NHL_SALARY_CAP-planned, percent:Math.max(0,planned/NHL_SALARY_CAP*100) };
}
function openRosterCounts(players=activeRosterPlayers()) {
  const counts={F:0,D:0,G:0}; players.forEach(player=>counts[positionGroup(player)]++);
  return Object.fromEntries(Object.entries(ACTIVE_ROSTER_TARGETS).map(([group,target])=>[group,Math.max(0,target-counts[group])]));
}
function minimumBudgetSlots(open) {
  return Object.fromEntries(Object.entries(open).map(([group,count])=>[group,Array.from({length:count},()=>NHL_LEAGUE_MINIMUM)]));
}
function distributeBudget(slots, extra, recipients, increment=50000) {
  if(extra<=0||!recipients.length)return 0;
  const usable=Math.max(0,Math.floor(extra/increment)*increment);
  const share=Math.floor(usable/recipients.length/increment)*increment;
  let allocated=0;
  recipients.forEach(([group,index])=>{slots[group][index]+=share;allocated+=share;});
  let remainder=usable-allocated;
  for(const [group,index] of recipients){if(remainder<increment)break;slots[group][index]+=increment;allocated+=increment;remainder-=increment;}
  return allocated;
}
function groupRecipients(slots,group){return slots[group].map((_,index)=>[group,index]);}
function allocateGroupWeighted(slots,extra,weights){
  const groups=['F','D','G'].filter(group=>slots[group].length&&number(weights[group])>0);
  const totalWeight=groups.reduce((sum,group)=>sum+number(weights[group]),0)||1;
  let allocated=0;
  groups.forEach((group,index)=>{
    const remaining=extra-allocated;
    const groupShare=index===groups.length-1?remaining:Math.floor(extra*number(weights[group])/totalWeight/50000)*50000;
    allocated+=distributeBudget(slots,groupShare,groupRecipients(slots,group));
  });
  if(extra-allocated>=50000){
    const all=groups.flatMap(group=>groupRecipients(slots,group));
    allocated+=distributeBudget(slots,extra-allocated,all);
  }
  return allocated;
}
function starterVacancyRecipients(active,slots){
  const counts={F:0,D:0,G:0}; active.forEach(player=>counts[positionGroup(player)]++);
  const recipients=[];
  for(const group of ['F','D','G']){
    const vacancies=Math.min(slots[group].length,Math.max(0,NIGHTLY_LIMITS[group]-counts[group]));
    for(let index=0;index<vacancies;index++)recipients.push([group,index]);
  }
  return recipients;
}
function premiumRecipientOrder(active,slots){
  const starters=starterVacancyRecipients(active,slots);
  const seen=new Set(starters.map(([group,index])=>`${group}:${index}`));
  const rest=['F','D','G'].flatMap(group=>groupRecipients(slots,group)).filter(([group,index])=>!seen.has(`${group}:${index}`));
  return [...starters,...rest];
}
function allocateDepthPlan(slots,extra,target=4000000){
  const recipients=['F','D','G'].flatMap(group=>groupRecipients(slots,group));
  let remaining=Math.max(0,extra);
  let active=recipients.slice();
  while(remaining>=50000&&active.length){
    const share=Math.max(50000,Math.floor(remaining/active.length/50000)*50000);
    let moved=0;
    const next=[];
    for(const [group,index] of active){
      const room=Math.max(0,target-slots[group][index]);
      const add=Math.min(room,share,remaining-moved);
      const rounded=Math.floor(add/50000)*50000;
      if(rounded>0){slots[group][index]+=rounded;moved+=rounded;}
      if(slots[group][index]<target)next.push([group,index]);
    }
    if(!moved)break;
    remaining-=moved; active=next;
  }
  return extra-remaining;
}
function buildBudgetPlan(mode=state.salary.plan) {
  if(!BUDGET_PLAN_DEFINITIONS[mode])mode='minimum';
  const active=activeRosterPlayers();
  const open=openRosterCounts(active);
  const cap=rosterCapSummary(active);
  const slots=minimumBudgetSlots(open);
  const minimumCost=Object.values(open).reduce((sum,count)=>sum+count*NHL_LEAGUE_MINIMUM,0);
  const extra=Math.max(0,cap.remaining-minimumCost);
  if(mode==='balanced')allocateGroupWeighted(slots,extra,{F:1.1,D:1,G:.8});
  else if(mode==='starters'){
    const recipients=starterVacancyRecipients(active,slots);
    distributeBudget(slots,extra,recipients.length?recipients:premiumRecipientOrder(active,slots).slice(0,1));
  } else if(mode==='oneStar')distributeBudget(slots,extra,premiumRecipientOrder(active,slots).slice(0,1));
  else if(mode==='twoStars')distributeBudget(slots,extra,premiumRecipientOrder(active,slots).slice(0,2));
  else if(mode==='forwards')allocateGroupWeighted(slots,extra,{F:6,D:2.5,G:1.5});
  else if(mode==='defence')allocateGroupWeighted(slots,extra,{F:2.5,D:6,G:1.5});
  else if(mode==='goalies')allocateGroupWeighted(slots,extra,{F:3,D:2,G:5});
  else if(mode==='depth')allocateDepthPlan(slots,extra,4000000);
  const baseSlots=Object.fromEntries(Object.entries(slots).map(([group,values])=>[group,[...values]]));
  const absoluteOneSlotMax=Math.max(NHL_LEAGUE_MINIMUM,cap.remaining-Math.max(0,Object.values(open).reduce((sum,count)=>sum+count,0)-1)*NHL_LEAGUE_MINIMUM);
  for(const group of ['F','D','G'])for(let index=0;index<slots[group].length;index++){
    const override=number(state.salary.slotOverrides[`${mode}|${group}|${index}`]);
    if(override>0)slots[group][index]=Math.min(absoluteOneSlotMax,Math.max(NHL_LEAGUE_MINIMUM,override));
  }
  const projectedOpen=Object.values(slots).flat().reduce((sum,value)=>sum+value,0);
  const reserve=cap.remaining-projectedOpen;
  const definition=BUDGET_PLAN_DEFINITIONS[mode];
  return { mode,label:definition.label,description:definition.description,slots,baseSlots,open,minimumCost,projectedOpen,reserve,cap,projectedTotal:cap.planned+projectedOpen };
}
function totalOpenSlots(plan){return Object.values(plan.open).reduce((sum,count)=>sum+count,0);}
function ensureSelectedBudgetSlot(plan){
  const selected=state.salary.selectedSlot;
  if(selected&&plan.open[selected.group]>selected.index)return selected;
  const group=['F','D','G'].find(code=>plan.open[code]>0);
  state.salary.selectedSlot=group?{group,index:0}:null;
  return state.salary.selectedSlot;
}
function budgetSlotKey(slot,mode=state.salary.plan){return slot?`${mode}|${slot.group}|${slot.index}`:'';}
function selectedSlotBudgetInfo(plan){
  const slot=ensureSelectedBudgetSlot(plan);
  if(!slot)return {slot:null,base:0,budget:0,hardMax:0,custom:false};
  const base=number(plan.baseSlots?.[slot.group]?.[slot.index]||plan.slots[slot.group]?.[slot.index]||NHL_LEAGUE_MINIMUM);
  const hardMax=Math.max(0,plan.cap.remaining-Math.max(0,totalOpenSlots(plan)-1)*NHL_LEAGUE_MINIMUM);
  const key=budgetSlotKey(slot,plan.mode);
  const override=number(state.salary.slotOverrides[key]);
  const budget=Math.min(hardMax,Math.max(NHL_LEAGUE_MINIMUM,override||base));
  return {slot,base,budget,hardMax,key,custom:override>0};
}
function playerValueRate(player){return number(player.capHit)>0?number(player.fpg)/(number(player.capHit)/1000000):0;}
function playerProjectedValueRate(player){return number(player.capHit)>0?playerRankingFpg(player)/(number(player.capHit)/1000000):0;}
function predictionBadge(player){const prediction=predictionForPlayer(player);return prediction?`PRED ${fmt(prediction,2)}`:'NO PREDICTION';}
function recommendationCandidates(plan){
  const info=selectedSlotBudgetInfo(plan);
  if(!info.slot)return [];
  const available=state.players.filter(player=>
    positionGroup(player)===info.slot.group&&
    !state.roster.includes(player.id)&&
    !player.keeper&&
    number(player.capHit)>0&&
    number(player.capHit)<=info.budget&&
    (number(player.gamesPlayed)>0||predictionForPlayer(player)>0)&&
    playerRankingFpg(player)>0
  );
  const sort=state.salary.recommendationSort;
  available.sort(sort==='VALUE'?(a,b)=>playerValueRate(b)-playerValueRate(a)||b.fpg-a.fpg:
    sort==='PROJECTED_VALUE'?(a,b)=>playerProjectedValueRate(b)-playerProjectedValueRate(a)||playerRankingFpg(b)-playerRankingFpg(a):
    sort==='PREDICTION'?(a,b)=>playerRankingFpg(b)-playerRankingFpg(a)||b.fpg-a.fpg:
    sort==='RECENT'?(a,b)=>b.recentFpg-a.recentFpg||b.fpg-a.fpg:
    sort==='TOTAL'?(a,b)=>b.fantasyPoints-a.fantasyPoints||b.fpg-a.fpg:
    (a,b)=>b.fpg-a.fpg||playerValueRate(b)-playerValueRate(a));
  return available.slice(0,5);
}
function salaryBadge(player, compact=false) {
  if(number(player?.capHit)>0)return money(player.capHit,compact);
  if(player?.salaryStatus==='unsigned')return 'UNSIGNED';
  return 'NOT IN MASTER';
}
function renderCapPlanner(plan) {
  const cap=plan.cap;
  $('#capUsed').textContent=money(cap.planned,true);
  $('#capRoom').textContent=money(cap.remaining,true);
  $('#capSigned').textContent=money(cap.signed);
  $('#capPlanned').textContent=money(cap.planned);
  $('#capRemaining').textContent=money(cap.remaining);
  $('#capLimit').textContent=money(NHL_SALARY_CAP);
  $('#capProgress').style.width=`${Math.min(100,cap.percent)}%`;
  $('#capProgress').classList.toggle('over',cap.remaining<0);
  const expected=number(state.salary.metadata.recordCount||state.salary.metadata.fullMasterExpectedRecords);
  const incomplete=expected>0&&state.salary.records.length<expected;
  $('#salaryMasterState').textContent=state.salary.status==='ready'?`${state.salary.records.length} FILE ROWS`:state.salary.status==='error'?'ESTIMATE MODE':'LOADING';
  $('#salaryMasterState').className=`status-badge ${state.salary.status==='error'||incomplete?'warning':''}`;
  const fileStatus=$('#salaryFileStatus');
  if(fileStatus)fileStatus.textContent=state.salary.status==='ready'?`${state.salary.records.length.toLocaleString('en-US')} packaged records across ${number(state.salary.metadata.teamCount)||32} NHL teams are being referenced automatically (${number(state.salary.metadata.signedCount)||state.salary.records.filter(record=>record.salary>0).length} signed; ${number(state.salary.metadata.zeroSalaryCount)||state.salary.records.filter(record=>record.salary===0).length} unsigned). ${Object.keys(state.salary.corrections).length} local salary update${Object.keys(state.salary.corrections).length===1?'':'s'} saved.`:state.salary.error;
  const unresolved=$('#unsignedEstimateEditor');
  unresolved.innerHTML=cap.unresolved.map(player=>`<label class="unsigned-estimate"><span><strong>${safeText(player.name)}</strong><small>${player.salaryStatus==='unsigned'?'Unsigned in static master':'No salary match'} · planning estimate</small></span><span class="money-input"><b>$</b><input type="number" min="${NHL_LEAGUE_MINIMUM}" step="50000" data-salary-estimate="${safeText(playerEstimateKey(player))}" value="${planningSalaryForPlayer(player)}"/></span></label>`).join('')||'<div class="cap-confirmed">Every active roster salary is signed and matched.</div>';
  $$('.budget-plan-button').forEach(button=>button.classList.toggle('active',button.dataset.budgetPlan===plan.mode));
  const reserveText=plan.reserve>=0?`${money(plan.reserve)} remains unassigned`:`${money(Math.abs(plan.reserve))} over the cap`;
  const allocationRows=['F','D','G'].map(group=>{
    const values=plan.slots[group]||[];
    const label=group==='F'?'F':group==='D'?'D':'G';
    return values.length?`<span><small>${label} slots</small><b>${values.map(value=>money(value,true)).join(' · ')}</b></span>`:'';
  }).join('');
  $('#budgetPlanSummary').innerHTML=`<div><strong>${safeText(plan.label)}</strong><span>${safeText(plan.description)} The allocation recalculates after every add or remove.</span></div><div class="budget-plan-numbers"><span><small>Open-slot budget</small><b>${money(plan.projectedOpen)}</b></span><span><small>Projected final cap</small><b>${money(plan.projectedTotal)}</b></span><span><small>After plan</small><b class="${plan.reserve<0?'negative':''}">${reserveText}</b></span></div><div class="budget-slot-allocation">${allocationRows||'<span><b>Roster complete</b></span>'}</div>`;
  $('#capWarning').innerHTML=cap.unresolved.length?`<strong>${cap.unresolved.length} estimated contract${cap.unresolved.length===1?'':'s'}:</strong> ${cap.unresolved.map(player=>safeText(player.name)).join(', ')}. These estimates affect planning but are not presented as signed cap hits.`:'All active salaries are confirmed in the static file.';
}

function recommendationSortLabel(value){return ({FPG:'FP/G',VALUE:'FP/G per $1M',PROJECTED_VALUE:'predicted FP/G per $1M',PREDICTION:'your prediction',RECENT:'recent form',TOTAL:'season FPTS'}[value]||'FP/G');}
function renderSlotRecommendations(plan){
  const badge=$('#selectedSlotBadge'),budgetBox=$('#selectedSlotBudget'),container=$('#slotRecommendations');
  if(!badge||!budgetBox||!container)return;
  const info=selectedSlotBudgetInfo(plan);
  const sortSelect=$('#recommendationSort');
  if(sortSelect)sortSelect.value=state.salary.recommendationSort;
  if(!info.slot){
    badge.textContent='ROSTER COMPLETE';
    budgetBox.innerHTML='<div class="cap-confirmed">All 23 active roster spots are filled.</div>';
    container.innerHTML='';
    return;
  }
  const groupName=info.slot.group==='F'?'Forward':info.slot.group==='D'?'Defence':'Goalie';
  badge.textContent=`${groupName.toUpperCase()} ${info.slot.index+1}`;
  budgetBox.innerHTML=`<div><small>Generated price</small><strong>${money(info.base)}</strong></div><label><small>Maximum spend for this search</small><span class="money-input"><b>$</b><input id="selectedSlotMax" type="number" min="${NHL_LEAGUE_MINIMUM}" max="${info.hardMax}" step="50000" value="${info.budget}" /></span></label><div><small>Absolute max</small><strong>${money(info.hardMax)}</strong><span>Leaves minimum salary for every other opening.</span></div><button class="text-button" id="resetSelectedSlotBudget" type="button" ${info.custom?'':'disabled'}>Reset to plan</button>`;
  const candidates=recommendationCandidates(plan);
  if(!candidates.length){
    container.innerHTML='<div class="assistant-empty">No signed player with season stats fits this exact position and budget in the packaged salary reference.</div>';
    return;
  }
  container.innerHTML=`<div class="recommendation-context">Top five by <strong>${recommendationSortLabel(state.salary.recommendationSort)}</strong> under <strong>${money(info.budget)}</strong></div>`+candidates.map((player,index)=>`<article class="slot-recommendation-row"><span class="rank">${index+1}</span><img src="${headshotUrl(player)}" alt="" onerror="this.style.opacity=.12"/><div><strong>${safeText(player.name)}</strong><small>${safeText(player.team)} · ${salaryBadge(player,true)} · ${fmt(player.fpg,2)} FP/G</small><span>${predictionForPlayer(player)?`${fmt(playerRankingFpg(player),2)} predicted · ${fmt(playerProjectedValueRate(player),2)} predicted FP/G per $1M`:`${fmt(playerValueRate(player),2)} FP/G per $1M`}${player.recentGames?` · ${fmt(player.recentFpg,2)} recent`:''}</span></div><button class="primary-button mini" data-add-roster="${player.id}" type="button">ADD</button></article>`).join('');
}

function openSlotBudgetFor(plan,group,index){ return number(plan.slots[group]?.[index]||NHL_LEAGUE_MINIMUM); }
function draftPlayerCanBeAdded(player){
  const group=positionGroup(player);
  const groupCount=activeRosterPlayers().filter(item=>positionGroup(item)===group).length;
  if(activeRosterCount()>=23||groupCount>=ACTIVE_ROSTER_TARGETS[group])return false;
  if(!number(player.capHit))return false;
  const projected=rosterCapSummary([...activeRosterPlayers(),player]);
  const remainingOpen=Math.max(0,23-(activeRosterCount()+1));
  return projected.planned+remainingOpen*NHL_LEAGUE_MINIMUM<=NHL_SALARY_CAP;
}
function renderDraftPool(plan){
  const search=state.salary.draftSearch.trim().toLowerCase();
  const position=state.salary.draftPosition;
  const selectedInfo=selectedSlotBudgetInfo(plan);
  let available=state.players.filter(player=>!state.roster.includes(player.id)&&!player.keeper&&(number(player.gamesPlayed)>0||predictionForPlayer(player)>0));
  if(search)available=available.filter(player=>`${player.name} ${player.team}`.toLowerCase().includes(search));
  if(position!=='ALL')available=available.filter(player=>positionGroup(player)===position);
  if(state.salary.draftFitsSlot&&selectedInfo.slot)available=available.filter(player=>positionGroup(player)===selectedInfo.slot.group&&number(player.capHit)>0&&number(player.capHit)<=selectedInfo.budget);
  const sort=state.salary.draftSort;
  available.sort(sort==='VALUE'?(a,b)=>playerValueRate(b)-playerValueRate(a)||b.fpg-a.fpg:
    sort==='PROJECTED_VALUE'?(a,b)=>playerProjectedValueRate(b)-playerProjectedValueRate(a)||playerRankingFpg(b)-playerRankingFpg(a):
    sort==='PREDICTION'?(a,b)=>playerRankingFpg(b)-playerRankingFpg(a)||b.fpg-a.fpg:
    sort==='RECENT'?(a,b)=>b.recentFpg-a.recentFpg||b.fpg-a.fpg:
    sort==='SALARY_LOW'?(a,b)=>(number(a.capHit)||Infinity)-(number(b.capHit)||Infinity)||b.fpg-a.fpg:
    sort==='SALARY_HIGH'?(a,b)=>number(b.capHit)-number(a.capHit)||b.fpg-a.fpg:
    (a,b)=>b.fpg-a.fpg||b.fantasyPoints-a.fantasyPoints);
  const rows=available.slice(0,50);
  $('#draftList').innerHTML=rows.map(player=>{
    const canAdd=draftPlayerCanBeAdded(player);
    const reason=!number(player.capHit)?(player.salaryStatus==='unsigned'?'UNSIGNED':'SALARY NEEDED'):canAdd?'ADD':'NO CAP/SLOT';
    return `<div class="draft-row"><img src="${headshotUrl(player)}" alt="" onerror="this.style.opacity=.15"/><div><strong>${safeText(player.name)}</strong><small>${player.team} · ${player.position} · ${player.gamesPlayed} GP</small><span class="draft-salary ${number(player.capHit)?'signed':'pending'}">${salaryBadge(player,true)}${number(player.capHit)?` · ${fmt(playerValueRate(player),2)} FP/G/$1M`:''}</span></div><div class="draft-score"><b>${fmt(player.fpg,2)}</b><span>${predictionForPlayer(player)?`${fmt(playerRankingFpg(player),2)} PRED`:`${fmt(player.fantasyPoints,1)} FPTS`}</span></div><button data-add-roster="${player.id}" ${canAdd?'':'disabled'}>${reason}</button></div>`;
  }).join('')||'<div class="empty-state">No players match these experiment filters.</div>';
}

function salaryEditorMatches() {
  const search=state.salary.editorSearch.trim().toLowerCase();
  if(!search)return [];
  return state.players.filter(player=>`${player.name} ${player.team} ${positionGroup(player)}`.toLowerCase().includes(search)).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,12);
}
function renderSalaryPredictionEditor() {
  const results=$('#salaryEditorResults'), form=$('#salaryEditorForm');
  if(!results||!form)return;
  const matches=salaryEditorMatches();
  results.innerHTML=state.salary.editorSearch?matches.map(player=>`<button type="button" class="salary-editor-result ${state.salary.editorPlayerId===player.id?'active':''}" data-edit-player="${player.id}"><span><strong>${safeText(player.name)}</strong><small>${player.team} · ${positionGroup(player)}</small></span><span><b>${salaryBadge(player,true)}</b><small>${predictionForPlayer(player)?`${fmt(playerRankingFpg(player),2)} predicted`:'No prediction'}</small></span></button>`).join('')||'<div class="assistant-empty">No player matches that search.</div>':'<div class="assistant-empty">Search any player in the 2,197-record salary master to update salary or add your own FP/G prediction.</div>';
  const player=state.players.find(item=>item.id===number(state.salary.editorPlayerId));
  if(!player){form.innerHTML='<div class="assistant-empty">Choose a player above.</div>';return;}
  const correction=salaryCorrectionFor(player);
  const salaryValue=correction===null?(number(player.capHit)||0):correction;
  const prediction=predictionForPlayer(player)||'';
  form.innerHTML=`<div class="salary-editor-player"><img src="${headshotUrl(player)}" alt="" onerror="this.src='${teamLogoUrl(player.team)}'"/><div><strong>${safeText(player.name)}</strong><small>${player.team} · ${positionGroup(player)} · file salary ${salaryBadge(player,true)}</small></div></div><label><span>2026-27 salary</span><input id="salaryEditorAmount" type="number" min="0" step="50000" value="${salaryValue}" /></label><label><span>Your predicted FP/G</span><input id="predictionEditorValue" type="number" min="0" step="0.01" placeholder="Example: 6.25" value="${prediction}" /></label><div class="salary-editor-actions"><button class="primary-button" id="savePlayerData" type="button">Save salary + prediction</button><button class="text-button" id="clearPlayerData" type="button">Clear my edits</button></div><small class="salary-editor-note">Salary edits override the packaged file in this browser. Predictions become available as draft and recommendation sorters.</small>`;
}
function saveSelectedPlayerData() {
  const player=state.players.find(item=>item.id===number(state.salary.editorPlayerId));
  if(!player)return;
  const key=playerDataKey(player);
  const salaryInput=$('#salaryEditorAmount');
  const predictionInput=$('#predictionEditorValue');
  if(salaryInput)state.salary.corrections[key]=Math.max(0,number(salaryInput.value));
  const prediction=number(predictionInput?.value);
  if(prediction>0)state.salary.predictions[key]=prediction; else delete state.salary.predictions[key];
  savePlayerOverrides(); applySalaryDataToPlayers(); invalidateTeamPlans();
  renderDraft(); renderCalendar(); applyPlayerFilters(); renderLab();
}
function clearSelectedPlayerData() {
  const player=state.players.find(item=>item.id===number(state.salary.editorPlayerId));
  if(!player)return;
  const key=playerDataKey(player); delete state.salary.corrections[key]; delete state.salary.predictions[key];
  savePlayerOverrides(); applySalaryDataToPlayers(); invalidateTeamPlans();
  renderDraft(); renderCalendar(); applyPlayerFilters(); renderLab();
}
function downloadUpdatedSalaryMaster() {
  const records=new Map(state.salary.records.map(record=>[salaryKey(record.name,record.team,record.position),{player:record.name,team:record.team,position:record.position,rosterStatus:record.rosterStatus||'',salary:number(record.salary),predictionFpg:null}]));
  for(const player of state.players){
    const key=playerDataKey(player); const correction=salaryCorrectionFor(player); const prediction=predictionForPlayer(player);
    if(correction===null&&!prediction)continue;
    const row=records.get(key)||{player:player.name,team:normalizeTeamCode(player.team),position:positionGroup(player),rosterStatus:'Nick update',salary:number(player.capHit)||0,predictionFpg:null};
    if(correction!==null)row.salary=correction;
    if(prediction)row.predictionFpg=prediction;
    records.set(key,row);
  }
  const payload={season:'2026-27',source:'FDA packaged salary reference plus Nick updates',generatedAt:new Date().toISOString(),records:[...records.values()].sort((a,b)=>a.team.localeCompare(b.team)||a.player.localeCompare(b.player))};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const link=document.createElement('a');
  link.href=url; link.download='FDA-SALARY-PREDICTION-MASTER-2026-27.json'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function renderDraft() {
  state.roster=state.roster.filter(id=>state.players.some(player=>player.id===id));
  seedKeeperRoster();
  saveRoster();
  const active=activeRosterPlayers();
  const minors=minorRosterPlayers();
  const counts={F:0,D:0,G:0}; active.forEach(player=>counts[positionGroup(player)]++);
  $('#rosterCount').textContent=active.length;
  $('#rosterF').textContent=`${counts.F} / ${ACTIVE_ROSTER_TARGETS.F}`;
  $('#rosterD').textContent=`${counts.D} / ${ACTIVE_ROSTER_TARGETS.D}`;
  $('#rosterG').textContent=`${counts.G} / ${ACTIVE_ROSTER_TARGETS.G}`;
  $('#rosterFpts').textContent=fmt(active.reduce((sum,player)=>sum+player.fantasyPoints,0),1);
  const plan=buildBudgetPlan();
  ensureSelectedBudgetSlot(plan);
  renderCapPlanner(plan);
  renderSalaryPredictionEditor();

  const mainGroups=['F','D','G'].map(group=>{
    const players=active.filter(player=>positionGroup(player)===group);
    const slots=Array.from({length:ACTIVE_ROSTER_TARGETS[group]},(_,index)=>players[index]||null);
    let openIndex=0;
    return `<div class="roster-group"><div class="roster-group-title"><strong>${group==='F'?'Forwards':group==='D'?'Defence':'Goalies'}</strong><span>${players.length} / ${ACTIVE_ROSTER_TARGETS[group]}</span></div><div class="slot-grid">${slots.map(player=>{
      if(player)return `<div class="roster-slot filled ${player.keeper?'keeper-slot':''}"><img src="${headshotUrl(player)}" alt="" onerror="this.src='${teamLogoUrl(player.team)}'"/><div><strong>${safeText(player.name)}</strong><small>${player.team} · ${fmt(player.fpg,2)} FP/G${predictionForPlayer(player)?` · ${fmt(playerRankingFpg(player),2)} PRED`:''}${player.keeper?' · KEEPER':''}</small><span class="slot-salary ${number(player.capHit)?'signed':'estimated'}">${number(player.capHit)?salaryBadge(player,true):`${salaryBadge(player)} · PLAN ${money(planningSalaryForPlayer(player),true)}`}</span></div>${player.keeper?'<span class="roster-lock">LOCKED</span>':`<button data-remove-roster="${player.id}" aria-label="Remove ${safeText(player.name)}" title="Remove player"></button>`}</div>`;
      const index=openIndex++;
      const estimate=openSlotBudgetFor(plan,group,index);
      const selected=state.salary.selectedSlot?.group===group&&state.salary.selectedSlot?.index===index;
      return `<button type="button" class="roster-slot empty budgeted-slot ${selected?'selected-budget-slot':''}" data-select-budget-slot="${group}:${index}"><span>OPEN ${group} ${index+1}</span><strong>${money(estimate,true)}</strong><small>${selected?'SELECTED · ':'PRESS TO SHOP · '}${safeText(plan.label)}</small></button>`;
    }).join('')}</div></div>`;
  }).join('');
  const minorGroup=`<div class="roster-group minor-roster-group"><div class="roster-group-title"><strong>Minors</strong><span>${minors.length} protected · outside 23 and active cap</span></div><div class="slot-grid minors-grid">${minors.map(player=>`<div class="roster-slot filled minor-slot"><img src="${headshotUrl(player)}" alt="" onerror="this.src='${teamLogoUrl(player.team)}'"/><div><strong>${safeText(player.name)}</strong><small>${player.team} · MINOR KEEPER</small><span class="slot-salary excluded">${number(player.capHit)?salaryBadge(player,true):'NOT IN MASTER'} · NOT COUNTED</span></div><span class="roster-lock">MINORS</span></div>`).join('')||'<div class="roster-slot empty">NO MINORS</div>'}</div></div>`;
  $('#rosterSlots').innerHTML=mainGroups+minorGroup;
  renderSlotRecommendations(plan);
  renderDraftPool(plan);
}

function renderRules() {
  const renderType=(type,element)=>{ element.innerHTML=Object.entries(state.rules[type]).map(([key,rule])=>`<label class="rule-row"><span><strong>${safeText(rule.label)}</strong><small>${safeText(rule.short)} · raw count × value</small></span><input type="number" step="0.05" data-rule-type="${type}" data-rule-key="${key}" value="${rule.value}"/></label>`).join(''); };
  renderType('skater',$('#skaterRules')); renderType('goalie',$('#goalieRules'));
}

function renderDataMode() {
  const label=state.dataMode==='exact'?'Exact event-synced database: every special category is included and the Fantrax validation suite passes.':state.dataMode==='synced-unvalidated'?'Game-event database loaded, but at least one verified Fantrax total does not match yet.':state.dataMode==='official-directory'||state.dataMode==='live'?`Complete NHL directory: ${state.players.length} players from official rosters and season reports. Event-only bonuses become exact after the Gamecenter sync.`:'The complete NHL directory could not be loaded; no tiny sample is being presented as the player pool.';
  $('#dataModeLabel').textContent=label; $('#diagnosticBadge').textContent=state.dataMode.toUpperCase().replaceAll('-',' '); $('#gamecenterState').textContent=state.dataMode==='exact'?'VALIDATED':state.dataMode==='synced-unvalidated'?'AUDIT':'SYNC FILE';
  $('#metricExact').textContent=state.players.filter(p=>p.dataQuality==='exact').length.toLocaleString('en-US');
}

function renderDiagnostics() {
  const list=$('#diagnosticList'); if(!list)return;
  list.innerHTML=state.diagnostics.slice().reverse().map(item=>`<div class="diagnostic-row"><i class="${item.status==='warn'?'warn':item.status==='error'?'error':''}"></i><div><strong>${safeText(item.title)}</strong><small>${safeText(item.detail)}</small></div><span>${safeText(item.value)}</span></div>`).join('')||'<div class="empty-state">No import attempts yet.</div>';
}

function calendarDatasetValid(payload) {
  return Boolean(payload && Array.isArray(payload.games) && payload.games.length >= 1200 && payload.teams && Object.keys(payload.teams).length >= 30);
}

function calendarDate(value) { return new Date(`${value}T12:00:00Z`); }
function dateKey(value) { return value.toISOString().slice(0,10); }
function addCalendarDays(value, days) { const next = new Date(value); next.setUTCDate(next.getUTCDate() + days); return next; }
function mondayOf(value) { const date = new Date(value); const day = date.getUTCDay(); return addCalendarDays(date, day === 0 ? -6 : 1 - day); }
function compactDate(value) { return calendarDate(value).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}); }
function teamDatesForWindow(team, range) {
  const dates = state.calendar.data?.teams?.[team]?.dates || [];
  return dates.filter(date => date >= range.start && date <= range.end);
}

function calendarRange(kind = state.calendar.window) {
  const metadata = state.calendar.data?.metadata || {};
  const start = metadata.startDate || state.calendar.data?.games?.[0]?.date;
  const end = metadata.endDate || state.calendar.data?.games?.at(-1)?.date;
  if (!start || !end) return { start:'', end:'' };
  if (kind === 'OPENING') return { start, end: dateKey(addCalendarDays(calendarDate(start), 55)) };
  if (kind === 'PLAYOFFS') return { start: dateKey(addCalendarDays(calendarDate(end), -27)), end };
  return { start, end };
}

function leagueCountsForRange(range) {
  const counts = {};
  for (const game of state.calendar.data?.games || []) {
    if (game.date < range.start || game.date > range.end) continue;
    counts[game.date] = (counts[game.date] || 0) + 1;
  }
  return counts;
}

function weeklyCoverage(dates) {
  const weeks = new Map();
  for (const date of dates) {
    const week = dateKey(mondayOf(calendarDate(date)));
    weeks.set(week, (weeks.get(week) || 0) + 1);
  }
  const values = [...weeks.values()];
  if (!values.length) return { average:0, consistency:0 };
  const average = values.reduce((sum,value)=>sum+value,0)/values.length;
  const variance = values.reduce((sum,value)=>sum+(value-average)**2,0)/values.length;
  const deviation = Math.sqrt(variance);
  return { average, consistency: Math.max(0, 1 - deviation / Math.max(1, average)) };
}

function pairAnalysis(teamA, teamB, range, leagueCounts) {
  const a = new Set(teamDatesForWindow(teamA, range));
  const b = new Set(teamDatesForWindow(teamB, range));
  const all = new Set([...a,...b]);
  const overlapDates = [...a].filter(date=>b.has(date));
  const sparse = date => number(leagueCounts[date]) <= state.calendar.threshold;
  const offNightStarts = [...a].filter(sparse).length + [...b].filter(sparse).length;
  const offNightCoverage = [...all].filter(sparse).length;
  const starts = a.size + b.size;
  const coverage = all.size;
  const conflictAvoidance = starts ? 1 - (overlapDates.length * 2 / starts) : 0;
  const coverageEfficiency = starts ? coverage / starts : 0;
  const coverageNormalized = Math.max(0, Math.min(1, (coverageEfficiency - .5) * 2));
  const offNightRate = starts ? offNightStarts / starts : 0;
  const week = weeklyCoverage(all);

  const fullPlayoffRange = calendarRange('PLAYOFFS');
  const playoffA = new Set(teamDatesForWindow(teamA, fullPlayoffRange));
  const playoffB = new Set(teamDatesForWindow(teamB, fullPlayoffRange));
  const playoffOverlap = [...playoffA].filter(date=>playoffB.has(date)).length;
  const playoffStarts = playoffA.size + playoffB.size;
  const playoffAvoidance = playoffStarts ? 1 - (playoffOverlap * 2 / playoffStarts) : 0;
  const playoffCoverage = new Set([...playoffA,...playoffB]).size;

  const score = 100 * (
    conflictAvoidance * .42 +
    coverageNormalized * .20 +
    Math.min(1, offNightRate * 1.6) * .18 +
    playoffAvoidance * .15 +
    week.consistency * .05
  );

  return {
    teamA, teamB, score:round(score,1), starts, coverage,
    overlap:overlapDates.length, uniqueStarts:Math.max(0,starts-overlapDates.length*2),
    offNightStarts, offNightCoverage, playoffCoverage, playoffOverlap,
    weeklyAverage:round(week.average,2), weeklyConsistency:round(week.consistency,3),
    overlapDates
  };
}

function trioAnalysis(teams, range, leagueCounts) {
  const dateLoads = new Map();
  let starts = 0;
  let offNightStarts = 0;
  for (const team of teams) {
    for (const date of teamDatesForWindow(team, range)) {
      starts += 1;
      if (number(leagueCounts[date]) <= state.calendar.threshold) offNightStarts += 1;
      dateLoads.set(date,(dateLoads.get(date)||0)+1);
    }
  }
  const coverage = dateLoads.size;
  const conflictStarts = [...dateLoads.values()].reduce((sum,load)=>sum+Math.max(0,load-1),0);
  const cleanDates = [...dateLoads.values()].filter(load=>load===1).length;
  const tripleDates = [...dateLoads.values()].filter(load=>load===3).length;
  const conflictAvoidance = starts ? 1 - conflictStarts / starts : 0;
  const coverageRate = starts ? coverage / starts : 0;
  const offNightRate = starts ? offNightStarts / starts : 0;

  const playoffRange = calendarRange('PLAYOFFS');
  const playoffLoads = new Map();
  let playoffStarts = 0;
  for (const team of teams) for (const date of teamDatesForWindow(team, playoffRange)) {
    playoffStarts += 1;
    playoffLoads.set(date,(playoffLoads.get(date)||0)+1);
  }
  const playoffConflicts = [...playoffLoads.values()].reduce((sum,load)=>sum+Math.max(0,load-1),0);
  const playoffAvoidance = playoffStarts ? 1 - playoffConflicts/playoffStarts : 0;
  const score = 100 * (conflictAvoidance*.48 + Math.min(1,coverageRate*1.45)*.22 + Math.min(1,offNightRate*1.6)*.15 + playoffAvoidance*.15);
  return { teams, score:round(score,1), starts, coverage, conflictStarts, cleanDates, tripleDates, offNightStarts, playoffCoverage:playoffLoads.size };
}

function recalculateCalendarAnalysis() {
  if (!calendarDatasetValid(state.calendar.data)) return;
  const range = calendarRange();
  const leagueCounts = leagueCountsForRange(range);
  const teams = Object.keys(state.calendar.data.teams).sort();
  const pairs = [];
  for (let i=0;i<teams.length;i+=1) for (let j=i+1;j<teams.length;j+=1) pairs.push(pairAnalysis(teams[i],teams[j],range,leagueCounts));
  state.calendar.pairs = pairs.sort((a,b)=>b.score-a.score || b.coverage-a.coverage);

  const trios = [];
  for (let i=0;i<teams.length;i+=1) for (let j=i+1;j<teams.length;j+=1) for (let k=j+1;k<teams.length;k+=1) trios.push(trioAnalysis([teams[i],teams[j],teams[k]],range,leagueCounts));
  state.calendar.trios = trios.sort((a,b)=>b.score-a.score || b.coverage-a.coverage).slice(0,30);

  const selectedStillExists = state.calendar.selectedPair && pairs.some(pair=>[pair.teamA,pair.teamB].sort().join('-') === [...state.calendar.selectedPair].sort().join('-'));
  if (!selectedStillExists) state.calendar.selectedPair = [state.calendar.pairs[0]?.teamA,state.calendar.pairs[0]?.teamB].filter(Boolean);
  state.calendar.weekIndex = 0;
}

function normalizeDirectScheduleGame(game) {
  return {
    id:number(game.id), season:number(game.season), gameType:number(game.gameType), date:game.gameDate,
    startTimeUTC:game.startTimeUTC||null, away:game.awayTeam?.abbrev||'', home:game.homeTeam?.abbrev||''
  };
}

async function loadCalendarDirectFromNHL() {
  const teams = NHL_TEAMS;
  const results = await Promise.allSettled(teams.map(async team=>({team,payload:await fetchJson(`${NHL_WEB}/club-schedule-season/${team}/${state.calendar.season}`,{timeout:18000,retries:1})})));
  const gameMap = new Map();
  for (const result of results) {
    if (result.status!=='fulfilled') continue;
    for (const raw of result.value.payload?.games || []) {
      const game=normalizeDirectScheduleGame(raw);
      if(game.id&&game.gameType===2&&String(game.season)===state.calendar.season&&game.date&&game.away&&game.home)gameMap.set(game.id,game);
    }
  }
  const games=[...gameMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const teamData=Object.fromEntries(teams.map(team=>[team,{dates:[],games:[],gameCount:0,backToBacks:0,dayCounts:{}}]));
  const leagueGamesByDate={};
  for(const game of games){
    leagueGamesByDate[game.date]=(leagueGamesByDate[game.date]||0)+1;
    for(const team of [game.away,game.home]) if(teamData[team]){teamData[team].dates.push(game.date);teamData[team].games.push(game.id);teamData[team].gameCount+=1;}
  }
  for(const team of teams) teamData[team].dates=[...new Set(teamData[team].dates)].sort();
  const dates=games.map(game=>game.date);
  const payload={season:state.calendar.season,generatedAt:new Date().toISOString(),source:'Official NHL schedules loaded directly in this browser',metadata:{gameCount:games.length,teamCount:teams.length,startDate:dates[0]||null,endDate:dates.at(-1)||null,successfulTeamRequests:results.filter(result=>result.status==='fulfilled').length},leagueGamesByDate,teams:teamData,games};
  if(!calendarDatasetValid(payload))throw new Error(`Only ${games.length} unique games were returned; FDA will not rank an incomplete schedule.`);
  return payload;
}

async function loadCalendarData({ force=false, direct=false }={}) {
  if(state.calendar.status==='loading')return;
  state.calendar.status='loading'; state.calendar.error=''; invalidateTeamPlans(); renderCalendar();
  try {
    let payload=null;
    if(direct){ payload=await loadCalendarDirectFromNHL(); }
    else {
      if(!force){
        try{
          const response=await fetch(`data/calendar-analysis.json?t=${Date.now()}`,{cache:'no-store'});
          if(response.ok){const cached=await response.json();if(calendarDatasetValid(cached)&&String(cached.season)===state.calendar.season)payload=cached;}
        }catch{}
      }
      if(!payload){
        const response=await fetch(`/api/calendar?season=${encodeURIComponent(state.calendar.season)}&t=${Date.now()}`,{cache:'no-store'});
        if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);
        payload=await response.json();
      }
    }
    if(!calendarDatasetValid(payload))throw new Error(payload?.error||'The schedule response was incomplete.');
    state.calendar.data=payload; state.calendar.status='ready';
    recalculateCalendarAnalysis();
    addDiagnostic('NHL schedule complement database',`${payload.metadata.gameCount} official games loaded for ${payload.season}.`,'ok',`${payload.metadata.teamCount} teams`);
  }catch(error){
    state.calendar.status='error'; state.calendar.error=error.message;
    addDiagnostic('Schedule complement engine',error.message,'warn','No rankings shown');
  }
  renderCalendar();
}

function calendarTopPlayer(team, position=null) {
  const candidates=state.players.filter(player=>player.team===team&&(!position||positionGroup(player)===position)&&player.gamesPlayed>=10&&!state.roster.includes(player.id));
  return candidates.sort((a,b)=>b.fpg-a.fpg||b.fantasyPoints-a.fantasyPoints)[0]||state.players.filter(player=>player.team===team&&(!position||positionGroup(player)===position)).sort((a,b)=>b.fpg-a.fpg)[0]||null;
}

function pairKey(pair) { return [pair.teamA,pair.teamB].sort().join('-'); }
function pairLogos(pair){return `<span class="pair-logo-stack"><img src="${teamLogoUrl(pair.teamA)}" alt="${pair.teamA}"/><img src="${teamLogoUrl(pair.teamB)}" alt="${pair.teamB}"/></span>`;}
function scoreClass(score){return score>=80?'elite':score>=70?'good':score>=60?'average':'poor';}

function renderPairSpotlight(element,pair,label) {
  if(!pair){element.innerHTML=`<p class="eyebrow">${label}</p><div class="calendar-loading">No pair available.</div>`;return;}
  element.innerHTML=`<p class="eyebrow">${label}</p><button class="spotlight-pair" data-calendar-pair="${pairKey(pair)}">${pairLogos(pair)}<div><h2>${pair.teamA} + ${pair.teamB}</h2><p>${pair.coverage} playable dates · ${pair.overlap} same-night conflicts</p></div><strong class="fit-score ${scoreClass(pair.score)}">${fmt(pair.score,1)}</strong></button><div class="spotlight-stats"><span><b>${pair.uniqueStarts}</b> staggered starts</span><span><b>${pair.offNightStarts}</b> sparse-night starts</span><span><b>${pair.playoffCoverage}</b> playoff dates</span></div>`;
}

function sortedCalendarPairs() {
  let pairs=[...state.calendar.pairs];
  if(state.calendar.focusTeam!=='ALL')pairs=pairs.filter(pair=>pair.teamA===state.calendar.focusTeam||pair.teamB===state.calendar.focusTeam);
  const sorts={score:(a,b)=>b.score-a.score,coverage:(a,b)=>b.coverage-a.coverage||b.score-a.score,offnights:(a,b)=>b.offNightStarts-a.offNightStarts||b.score-a.score,playoffs:(a,b)=>b.playoffCoverage-a.playoffCoverage||a.playoffOverlap-b.playoffOverlap,conflicts:(a,b)=>a.overlap-b.overlap||b.coverage-a.coverage};
  return pairs.sort(sorts[state.calendar.sort]||sorts.score);
}

function populateTeamPairLookup() {
  const select = $('#teamPairLookup');
  if (!select) return;
  const teams = Object.keys(state.calendar.data?.teams || {}).sort();
  if (!teams.includes(state.calendar.lookupTeam)) state.calendar.lookupTeam = teams[0] || '';
  select.innerHTML = teams.map(team => `<option value="${team}">${team}</option>`).join('');
  select.value = state.calendar.lookupTeam;
}

function teamPairLookupRows() {
  const selected = state.calendar.lookupTeam;
  if (!selected || !state.calendar.data?.teams?.[selected]) return [];
  const range = calendarRange();
  const selectedDates = new Set(teamDatesForWindow(selected, range));
  return state.calendar.pairs
    .filter(pair => pair.teamA === selected || pair.teamB === selected)
    .map(pair => {
      const partner = pair.teamA === selected ? pair.teamB : pair.teamA;
      const partnerDates = new Set(teamDatesForWindow(partner, range));
      const selectedOnly = [...selectedDates].filter(date => !partnerDates.has(date)).length;
      const partnerOnly = [...partnerDates].filter(date => !selectedDates.has(date)).length;
      const differentNights = selectedOnly + partnerOnly;
      const combinedStarts = selectedDates.size + partnerDates.size;
      const complementRate = combinedStarts ? differentNights / combinedStarts * 100 : 0;
      return { pair, partner, selectedGames:selectedDates.size, partnerGames:partnerDates.size, selectedOnly, partnerOnly, differentNights, sameNight:pair.overlap, complementRate };
    })
    .sort((a,b) => b.differentNights - a.differentNights || a.sameNight - b.sameNight || b.pair.score - a.pair.score)
    .slice(0,5);
}

function renderTeamPairLookup() {
  const summary = $('#teamPairLookupSummary');
  const container = $('#teamPairLookupResults');
  if (!summary || !container) return;
  const selected = state.calendar.lookupTeam;
  const rows = teamPairLookupRows();
  if (!selected || !rows.length) {
    summary.textContent = 'Select a team after the official schedule loads.';
    container.innerHTML = '<div class="calendar-loading">No team comparison is available yet.</div>';
    return;
  }
  const best = rows[0];
  summary.innerHTML = `<strong>${selected}</strong> plays ${best.selectedGames} games in this window. Its best schedule partner is <strong>${best.partner}</strong>: ${best.differentNights} different-night games across the two clubs, ${best.sameNight} same-night dates, and ${best.partnerOnly} games where ${best.partner} plays while ${selected} is off.`;
  container.innerHTML = rows.map((row,index) => `<button class="team-pair-lookup-row" data-calendar-pair="${pairKey(row.pair)}" type="button">
    <span class="team-pair-lookup-rank">${index+1}</span>
    <span class="team-pair-lookup-team">${pairLogos(row.pair)}<span><strong>${selected} + ${row.partner}</strong><small>${fmt(row.complementRate,1)}% of combined team-games avoid a same-night conflict</small></span></span>
    <span><b>${row.differentNights}</b><small>different-night games</small></span>
    <span><b>${row.sameNight}</b><small>same-night dates</small></span>
    <span><b>${row.partnerOnly}</b><small>${row.partner} while ${selected} off</small></span>
    <span><b>${row.selectedOnly}</b><small>${selected} while ${row.partner} off</small></span>
  </button>`).join('');
}

function renderStarPairs() {
  const container=$('#starPairGrid');
  if(!state.players.length){container.innerHTML='<div class="calendar-loading">The player directory must load before FDA can attach stars to team pairings.</div>';return;}
  const candidates=state.calendar.pairs.slice(0,18).map(pair=>({pair,a:calendarTopPlayer(pair.teamA),b:calendarTopPlayer(pair.teamB)})).filter(row=>row.a&&row.b).slice(0,6);
  container.innerHTML=candidates.map(({pair,a,b},index)=>`<button class="star-pair-card" data-calendar-pair="${pairKey(pair)}"><span class="star-rank">#${index+1}</span><div class="star-player"><img src="${headshotUrl(a)}" alt=""/><strong>${safeText(a.name)}</strong><small>${a.team} · ${fmt(a.fpg,2)} FP/G</small></div><div class="pair-bridge"><b>${fmt(pair.score,1)}</b><span>FIT</span><small>${pair.overlap} conflicts</small></div><div class="star-player"><img src="${headshotUrl(b)}" alt=""/><strong>${safeText(b.name)}</strong><small>${b.team} · ${fmt(b.fpg,2)} FP/G</small></div></button>`).join('')||'<div class="calendar-loading">No superstar pair can be formed from the current player data.</div>';
}

function renderGoaliePairs() {
  const container=$('#goaliePairGrid');
  if(!state.players.length){container.innerHTML='<div class="calendar-loading">The goalie directory must load before tandem analysis can run.</div>';return;}
  const candidates=state.calendar.pairs.map(pair=>({pair,a:calendarTopPlayer(pair.teamA,'G'),b:calendarTopPlayer(pair.teamB,'G')})).filter(row=>row.a&&row.b).map(row=>({...row,blend:row.pair.score+(row.a.fpg+row.b.fpg)*.35})).sort((a,b)=>b.blend-a.blend).slice(0,6);
  container.innerHTML=candidates.map(({pair,a,b},index)=>`<button class="goalie-pair-card" data-calendar-pair="${pairKey(pair)}"><span class="star-rank">#${index+1}</span><div class="goalie-pair-players"><span><img src="${headshotUrl(a)}" alt=""/><strong>${safeText(a.name)}</strong><small>${a.team} · ${fmt(a.fpg,2)} FP/G</small></span><b>+</b><span><img src="${headshotUrl(b)}" alt=""/><strong>${safeText(b.name)}</strong><small>${b.team} · ${fmt(b.fpg,2)} FP/G</small></span></div><div class="goalie-pair-stats"><strong>${fmt(pair.score,1)} fit</strong><span>${pair.overlap} same-night team games</span><span>${pair.offNightStarts} sparse-night team starts</span></div></button>`).join('')||'<div class="calendar-loading">No two-goalie combinations are available from the loaded player data.</div>';
}

function renderPairRankings() {
  const pairs=sortedCalendarPairs();
  const visible=pairs.slice(0,state.calendar.visiblePairs);
  $('#pairRankingList').innerHTML=visible.map((pair,index)=>`<button class="pair-ranking-row ${state.calendar.selectedPair&&pairKey(pair)===[...state.calendar.selectedPair].sort().join('-')?'selected':''}" data-calendar-pair="${pairKey(pair)}"><span class="pair-name"><b>${index+1}</b>${pairLogos(pair)}<strong>${pair.teamA} + ${pair.teamB}</strong></span><span><b class="fit-score ${scoreClass(pair.score)}">${fmt(pair.score,1)}</b></span><span><b>${pair.coverage}</b><small>dates</small></span><span><b>${pair.overlap}</b><small>same night</small></span><span><b>${pair.offNightStarts}</b><small>starts</small></span><span><b>${pair.playoffCoverage}</b><small>dates</small></span></button>`).join('')||'<div class="calendar-loading">No combinations match the selected team.</div>';
  $('#loadMorePairs').style.display=pairs.length>state.calendar.visiblePairs?'block':'none';
}

function renderTrios() {
  $('#trioList').innerHTML=state.calendar.trios.slice(0,10).map((trio,index)=>`<article class="trio-row"><span class="rank">${index+1}</span><span class="trio-logos">${trio.teams.map(team=>`<img src="${teamLogoUrl(team)}" alt="${team}"/>`).join('')}</span><div><strong>${trio.teams.join(' + ')}</strong><small>${trio.coverage} coverage dates · ${trio.conflictStarts} extra same-night starts</small></div><b class="fit-score ${scoreClass(trio.score)}">${fmt(trio.score,1)}</b></article>`).join('');
}

function renderTeamProfiles() {
  const range=calendarRange(); const leagueCounts=leagueCountsForRange(range);
  const profiles=Object.keys(state.calendar.data.teams).map(team=>{
    const dates=teamDatesForWindow(team,range); const best=state.calendar.pairs.filter(pair=>pair.teamA===team||pair.teamB===team).sort((a,b)=>b.score-a.score)[0];
    return {team,games:dates.length,off:dates.filter(date=>number(leagueCounts[date])<=state.calendar.threshold).length,busy:dates.filter(date=>number(leagueCounts[date])>=10).length,b2b:state.calendar.data.teams[team].backToBacks||0,best:best?[best.teamA,best.teamB].find(code=>code!==team):'-',score:best?.score||0};
  }).sort((a,b)=>b.off-a.off||a.busy-b.busy).slice(0,12);
  $('#teamScheduleProfiles').innerHTML=profiles.map(profile=>`<article class="team-profile-row"><img src="${teamLogoUrl(profile.team)}" alt=""/><div><strong>${profile.team}</strong><small>Best partner: ${profile.best} (${fmt(profile.score,1)})</small></div><span><b>${profile.off}</b> off-night</span><span><b>${profile.busy}</b> busy</span><span><b>${profile.b2b}</b> B2B</span></article>`).join('');
}

function playerLineupRating(player) {
  const fpg=number(player.fpg);
  if(fpg>0)return fpg;
  return positionGroup(player)==='G' ? .01 : .005;
}

function simulateBestLineup(players, range) {
  const leagueCounts=leagueCountsForRange(range);
  const dateSets=new Map();
  const datesFor=team=>{
    if(!dateSets.has(team))dateSets.set(team,new Set(teamDatesForWindow(team,range)));
    return dateSets.get(team);
  };
  const contributions=new Map(players.map(player=>[player.id,{dressed:0,benched:0,offNight:0,projectedFantasy:0}]));
  let totalUsable=0,totalPossible=0,benchStarts=0,offNightStarts=0,projectedFantasy=0;
  const dates=Object.keys(leagueCounts).sort();
  for(const date of dates){
    for(const group of ['F','D','G']){
      const playing=players.filter(player=>positionGroup(player)===group&&datesFor(player.team).has(date)).sort((a,b)=>playerLineupRating(b)-playerLineupRating(a)||number(b.gamesPlayed)-number(a.gamesPlayed));
      totalPossible+=playing.length;
      const dressed=playing.slice(0,NIGHTLY_LIMITS[group]);
      const benched=playing.slice(NIGHTLY_LIMITS[group]);
      totalUsable+=dressed.length;
      benchStarts+=benched.length;
      for(const player of dressed){
        const row=contributions.get(player.id); if(!row)continue;
        row.dressed+=1; row.projectedFantasy+=number(player.fpg);
        projectedFantasy+=number(player.fpg);
        if(number(leagueCounts[date])<=state.calendar.threshold){row.offNight+=1;offNightStarts+=1;}
      }
      for(const player of benched){const row=contributions.get(player.id);if(row)row.benched+=1;}
    }
  }
  return {totalUsable,totalPossible,benchStarts,offNightStarts,projectedFantasy:round(projectedFantasy,1),contributions};
}

function availableCalendarCandidates(position, excludedIds=new Set()) {
  return state.players
    .filter(player=>positionGroup(player)===position&&!player.keeper&&!state.roster.includes(player.id)&&!excludedIds.has(player.id)&&player.team&&state.calendar.data?.teams?.[player.team])
    .filter(player=>player.gamesPlayed>=5||player.currentRoster)
    .sort((a,b)=>b.fpg-a.fpg||b.gamesPlayed-a.gamesPlayed);
}

function calendarCandidateShortlist(position, excludedIds=new Set()) {
  const seenTeams=new Set();
  return availableCalendarCandidates(position,excludedIds).filter(player=>{
    if(seenTeams.has(player.team))return false;
    seenTeams.add(player.team);
    return true;
  });
}

function bestCandidateForTeam(team, position, excludedIds=new Set()) {
  return availableCalendarCandidates(position,excludedIds).find(player=>player.team===team)||null;
}

function invalidateTeamPlans() {
  state.calendar.teamPlans=[];
  state.calendar.generatorStatus='idle';
  state.calendar.generatorError='';
}

function renderRosterFit() {
  const list=$('#rosterFitList'), summary=$('#rosterFitSummary');
  const active=activeRosterPlayers();
  if(!active.length){summary.textContent='Your keeper roster has not loaded yet.';list.innerHTML='';return;}
  const position=$('#rosterFitPosition').value;
  const range=calendarRange();
  const baseline=simulateBestLineup(active,range);
  const rows=Object.keys(state.calendar.data.teams).map(team=>{
    const player=bestCandidateForTeam(team,position);
    if(!player)return null;
    const result=simulateBestLineup([...active,player],range);
    const contribution=result.contributions.get(player.id)||{dressed:0,benched:0,offNight:0};
    return {team,player,dressed:contribution.dressed,bench:contribution.benched,off:contribution.offNight,incremental:result.totalUsable-baseline.totalUsable,projected:result.projectedFantasy-baseline.projectedFantasy};
  }).filter(Boolean).sort((a,b)=>b.incremental-a.incremental||b.dressed-a.dressed||b.off-a.off||b.player.fpg-a.player.fpg).slice(0,12);
  summary.innerHTML=`Your <strong>${active.length}-player active roster</strong> currently produces ${baseline.totalUsable} dressable player-games in this window when FDA always starts the best ${NIGHTLY_LIMITS.F} forwards, ${NIGHTLY_LIMITS.D} defencemen and ${NIGHTLY_LIMITS.G} goalies. These teams show the best next ${position==='F'?'forward':position==='D'?'defence':'goalie'} calendar additions.`;
  list.innerHTML=rows.map((row,index)=>`<article class="roster-fit-row"><span class="rank">${index+1}</span><img class="team-logo-large" src="${teamLogoUrl(row.team)}" alt=""/><div><strong>${row.team} · ${safeText(row.player.name)}</strong><small>${fmt(row.player.fpg,2)} FP/G example · +${row.incremental} total dressed starts</small></div><span><b>${row.dressed}</b> dressed</span><span><b>${row.off}</b> off-night</span><span class="${row.bench?'warning':''}"><b>${row.bench}</b> benched</span></article>`).join('');
}

function rosterForwardPartnerRows() {
  const range=calendarRange();
  const leagueCounts=leagueCountsForRange(range);
  const forwards=activeRosterPlayers().filter(player=>positionGroup(player)==='F');
  const rosterIds=new Set(state.roster);
  const cap=rosterCapSummary(activeRosterPlayers());
  const openSlots=Math.max(0,23-activeRosterCount());
  const hardMax=Math.max(0,cap.remaining-Math.max(0,openSlots-1)*NHL_LEAGUE_MINIMUM);
  const candidates=state.players.filter(player=>positionGroup(player)==='F'&&!rosterIds.has(player.id)&&!player.keeper&&(number(player.gamesPlayed)>0||predictionForPlayer(player)>0)&&number(player.capHit)>0&&number(player.capHit)<=hardMax);
  const maxProduction=Math.max(1,...candidates.map(playerRankingFpg));
  const maxEfficiency=Math.max(1,...candidates.map(playerProjectedValueRate));
  return forwards.map(forward=>{
    const home=new Set(teamDatesForWindow(forward.team,range));
    const allPartners=Object.keys(state.calendar.data.teams).filter(other=>other!==forward.team).map(other=>{
      const dates=teamDatesForWindow(other,range);
      const opposite=dates.filter(date=>!home.has(date)).length;
      const overlap=dates.filter(date=>home.has(date)).length;
      const sparseOpposite=dates.filter(date=>!home.has(date)&&number(leagueCounts[date])<=state.calendar.threshold).length;
      return {team:other,opposite,overlap,sparseOpposite,score:opposite*2+sparseOpposite*.75-overlap*.45};
    }).sort((a,b)=>b.score-a.score||b.opposite-a.opposite);
    const minSchedule=Math.min(...allPartners.map(item=>item.score));
    const maxSchedule=Math.max(...allPartners.map(item=>item.score));
    const scoreCandidate=(player,partner)=>{
      const production=playerRankingFpg(player)/maxProduction*100;
      const efficiency=playerProjectedValueRate(player)/maxEfficiency*100;
      const calendar=maxSchedule===minSchedule?100:(partner.score-minSchedule)/(maxSchedule-minSchedule)*100;
      return {total:round(production*.5+efficiency*.3+calendar*.2,1),production:round(production,0),efficiency:round(efficiency,0),calendar:round(calendar,0)};
    };
    const partners=allPartners.slice(0,3).map(partner=>{
      const teamPlayers=candidates.filter(player=>player.team===partner.team);
      const choose=pool=>pool.map(player=>({player,fit:scoreCandidate(player,partner)})).sort((a,b)=>b.fit.total-a.fit.total||playerRankingFpg(b.player)-playerRankingFpg(a.player))[0]||null;
      return { ...partner, low:choose(teamPlayers.filter(player=>number(player.capHit)<=CALENDAR_LOW_CAP_MAX)), high:choose(teamPlayers.filter(player=>number(player.capHit)>CALENDAR_LOW_CAP_MAX)) };
    });
    return {forward,partners,hardMax};
  });
}
function calendarCandidateHtml(candidate,tier) {
  if(!candidate)return `<div class="calendar-player-pick empty"><span>${tier}</span><small>No signed match in this tier</small></div>`;
  const player=candidate.player, canAdd=draftPlayerCanBeAdded(player);
  return `<div class="calendar-player-pick"><span>${tier}</span><img src="${headshotUrl(player)}" alt="" onerror="this.style.opacity=.15"/><div><strong>${safeText(player.name)}</strong><small>${salaryBadge(player,true)} · ${fmt(playerRankingFpg(player),2)} ${predictionForPlayer(player)?'predicted':'FP/G'}</small><em>Value Fit ${fmt(candidate.fit.total,1)} · P${candidate.fit.production} / $${candidate.fit.efficiency} / C${candidate.fit.calendar}</em></div><button class="primary-button mini" data-add-roster="${player.id}" ${canAdd?'':'disabled'} type="button">${canAdd?'ADD':'NO SLOT/CAP'}</button></div>`;
}
function renderKeeperPartners() {
  const container=$('#keeperPartnerGrid'); if(!container)return;
  const rows=rosterForwardPartnerRows();
  if(!rows.length){container.innerHTML='<div class="calendar-loading">No active forwards are currently on the roster.</div>';return;}
  container.innerHTML=rows.map(row=>`<article class="forward-partner-card"><header><img src="${headshotUrl(row.forward)}" alt="" onerror="this.src='${teamLogoUrl(row.forward.team)}'"/><div><strong>${safeText(row.forward.name)}</strong><small>${row.forward.team} · ${fmt(row.forward.fpg,2)} FP/G${predictionForPlayer(row.forward)?` · ${fmt(playerRankingFpg(row.forward),2)} predicted`:''}</small></div><span>${money(row.hardMax,true)} max add</span></header><div class="forward-partner-teams">${row.partners.map((partner,index)=>`<section class="forward-partner-team"><div class="partner-team-summary"><span class="rank">${index+1}</span><img src="${teamLogoUrl(partner.team)}" alt=""/><div><strong>${partner.team}</strong><small>${partner.opposite} games while ${row.forward.team} is off · ${partner.overlap} conflicts · ${partner.sparseOpposite} sparse-night games</small></div></div><div class="calendar-pick-grid">${calendarCandidateHtml(partner.low,`LOW ≤ ${money(CALENDAR_LOW_CAP_MAX,true)}`)}${calendarCandidateHtml(partner.high,`HIGH > ${money(CALENDAR_LOW_CAP_MAX,true)}`)}</div></section>`).join('')}</div></article>`).join('');
}

function planObjective(result,baseline,strategy,playoffResult=null,playoffBaseline=null) {
  const delta=result.totalUsable-baseline.totalUsable;
  const benchDelta=result.benchStarts-baseline.benchStarts;
  const offDelta=result.offNightStarts-baseline.offNightStarts;
  if(strategy==='OFF_NIGHTS')return delta*100+offDelta*12-benchDelta*18+result.projectedFantasy*.001;
  if(strategy==='PLAYOFFS'){
    const playoffDelta=(playoffResult?.totalUsable||0)-(playoffBaseline?.totalUsable||0);
    const playoffBench=(playoffResult?.benchStarts||0)-(playoffBaseline?.benchStarts||0);
    return delta*35+playoffDelta*120-offDelta*.2-playoffBench*20+result.projectedFantasy*.001;
  }
  return delta*100+offDelta*3-benchDelta*22+result.projectedFantasy*.001;
}

function buildOneTeamPlan(strategy) {
  const fullRange=calendarRange();
  const playoffRange=calendarRange('PLAYOFFS');
  const current=[...activeRosterPlayers()];
  const need={F:ACTIVE_ROSTER_TARGETS.F-current.filter(player=>positionGroup(player)==='F').length,D:ACTIVE_ROSTER_TARGETS.D-current.filter(player=>positionGroup(player)==='D').length,G:ACTIVE_ROSTER_TARGETS.G-current.filter(player=>positionGroup(player)==='G').length};
  const selected=[]; const excluded=new Set(current.map(player=>player.id));
  while(Object.values(need).some(value=>value>0)){
    const baseline=simulateBestLineup(current,fullRange);
    const playoffBaseline=strategy==='PLAYOFFS'?simulateBestLineup(current,playoffRange):null;
    let best=null;
    for(const position of ['F','D','G']){
      if(need[position]<=0)continue;
      for(const candidate of calendarCandidateShortlist(position,excluded)){
        const result=simulateBestLineup([...current,candidate],fullRange);
        const playoffResult=strategy==='PLAYOFFS'?simulateBestLineup([...current,candidate],playoffRange):null;
        const score=planObjective(result,baseline,strategy,playoffResult,playoffBaseline);
        if(!best||score>best.score)best={candidate,result,playoffResult,score,baseline,playoffBaseline};
      }
    }
    if(!best)break;
    current.push(best.candidate); excluded.add(best.candidate.id); need[positionGroup(best.candidate)]-=1;
    const contribution=best.result.contributions.get(best.candidate.id)||{dressed:0,benched:0,offNight:0};
    selected.push({player:best.candidate,...contribution,incremental:best.result.totalUsable-best.baseline.totalUsable});
  }
  const finalResult=simulateBestLineup(current,fullRange);
  const initialResult=simulateBestLineup(activeRosterPlayers(),fullRange);
  const finalSelected=selected.map(row=>({...row,...(finalResult.contributions.get(row.player.id)||{dressed:0,benched:0,offNight:0})}));
  return {strategy,selected:finalSelected,totalUsable:finalResult.totalUsable,addedUsable:finalResult.totalUsable-initialResult.totalUsable,benchStarts:finalResult.benchStarts,projectedFantasy:finalResult.projectedFantasy};
}

function generateTeamPlans() {
  state.calendar.generatorStatus='loading'; state.calendar.generatorError=''; renderTeamPlans();
  setTimeout(()=>{
    try{
      state.calendar.teamPlans=['MAX_STARTS','OFF_NIGHTS','PLAYOFFS'].map(buildOneTeamPlan);
      state.calendar.generatorStatus='ready';
    }catch(error){state.calendar.generatorStatus='error';state.calendar.generatorError=error.message;}
    renderTeamPlans();
  },20);
}

function renderTeamPlans() {
  const container=$('#teamPlanResults'); if(!container)return;
  const button=$('#generateTeamPlans');
  if(button){button.disabled=state.calendar.generatorStatus==='loading';button.textContent=state.calendar.generatorStatus==='loading'?'Simulating…':'Generate team plans';}
  const counts={F:0,D:0,G:0}; activeRosterPlayers().forEach(player=>counts[positionGroup(player)]++);
  const needs={F:Math.max(0,ACTIVE_ROSTER_TARGETS.F-counts.F),D:Math.max(0,ACTIVE_ROSTER_TARGETS.D-counts.D),G:Math.max(0,ACTIVE_ROSTER_TARGETS.G-counts.G)};
  const explainer=$('#teamPlanExplainer'); if(explainer)explainer.textContent=`FDA fills your remaining ${needs.F} forward, ${needs.D} defence and ${needs.G} goalie slots, then re-runs every night of the season. The result is a schedule-first team shopping list—not a claim that the example player is automatically the best value.`;
  if(state.calendar.generatorStatus==='loading'){container.innerHTML='<div class="calendar-loading">Simulating every open roster slot against the nightly lineup limits…</div>';return;}
  if(state.calendar.generatorStatus==='error'){container.innerHTML=`<div class="history-error">${safeText(state.calendar.generatorError)}</div>`;return;}
  if(!state.calendar.teamPlans.length){container.innerHTML='<div class="calendar-loading">Generate plans after the official schedule loads. FDA will return three complete team maps for your remaining roster slots.</div>';return;}
  const labels={MAX_STARTS:['Maximum starts','Pure season-long dressed-game volume'],OFF_NIGHTS:['Off-night bench','Extra weight on nights when the NHL slate is lighter'],PLAYOFFS:['Playoff finish','Extra weight on the final four fantasy weeks']};
  container.innerHTML=state.calendar.teamPlans.map(plan=>{
    const teamCounts={}; plan.selected.forEach(row=>{teamCounts[row.player.team]=(teamCounts[row.player.team]||0)+1;});
    const teams=Object.entries(teamCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    return `<article class="team-plan-card"><header><div><p class="eyebrow">${labels[plan.strategy][0].toUpperCase()}</p><h3>${labels[plan.strategy][0]}</h3><small>${labels[plan.strategy][1]}</small></div><strong>+${plan.addedUsable}<small>dressed starts</small></strong></header><div class="team-plan-summary">${teams.map(([team,count])=>`<span><img src="${teamLogoUrl(team)}" alt=""/><b>${team}${count>1?` ×${count}`:''}</b></span>`).join('')}</div><div class="team-plan-picks">${plan.selected.map((row,index)=>`<span><b>${index+1}. ${positionGroup(row.player)} · ${row.player.team}</b><small>${safeText(row.player.name)} example · ${row.dressed} dressed / ${row.benched} bench</small></span>`).join('')}</div><footer>${plan.totalUsable} total dressed player-games · ${plan.benchStarts} unavoidable bench games</footer></article>`;
  }).join('');
}

function calendarWeeks(range) {
  if(!range.start||!range.end)return[];
  let current=mondayOf(calendarDate(range.start)); const finish=calendarDate(range.end); const weeks=[];
  while(current<=finish){weeks.push(new Date(current));current=addCalendarDays(current,7);}return weeks;
}

function renderWeeklyCalendar() {
  const selected=state.calendar.selectedPair;
  if(!selected?.length){$('#weeklyCalendar').innerHTML='<div class="calendar-loading">Select a team pair.</div>';return;}
  const range=calendarRange(); const weeks=calendarWeeks(range); state.calendar.weekIndex=Math.max(0,Math.min(state.calendar.weekIndex,weeks.length-1)); const start=weeks[state.calendar.weekIndex];
  if(!start)return;
  const leagueCounts=leagueCountsForRange(range); const [a,b]=selected; const datesA=new Set(teamDatesForWindow(a,range)); const datesB=new Set(teamDatesForWindow(b,range));
  $('#calendarBoardTitle').textContent=`${a} + ${b} weekly calendar`;
  $('#calendarWeekLabel').textContent=`${compactDate(dateKey(start))} - ${compactDate(dateKey(addCalendarDays(start,6)))}`;
  $('#calendarPrevWeek').disabled=state.calendar.weekIndex===0; $('#calendarNextWeek').disabled=state.calendar.weekIndex>=weeks.length-1;
  $('#weeklyCalendar').innerHTML=Array.from({length:7},(_,index)=>{
    const date=dateKey(addCalendarDays(start,index)); const playsA=datesA.has(date),playsB=datesB.has(date),count=number(leagueCounts[date]);
    const classes=[playsA&&playsB?'both':playsA||playsB?'single':'empty',count<=state.calendar.threshold&&count>0?'sparse':''].join(' ');
    return `<article class="calendar-day ${classes}"><header><span>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index]}</span><b>${compactDate(date)}</b></header><div class="calendar-day-teams">${playsA?`<img src="${teamLogoUrl(a)}" alt="${a}"/><strong>${a}</strong>`:''}${playsB?`<img src="${teamLogoUrl(b)}" alt="${b}"/><strong>${b}</strong>`:''}${!playsA&&!playsB?'<small>Both off</small>':''}</div><footer>${count} NHL game${count===1?'':'s'}${count&&count<=state.calendar.threshold?' · OFF NIGHT':''}</footer></article>`;
  }).join('');
}

function populateCalendarTeamFilter() {
  const select=$('#calendarTeam'); const current=state.calendar.focusTeam;
  select.innerHTML='<option value="ALL">League-wide</option>'+Object.keys(state.calendar.data?.teams||{}).sort().map(team=>`<option value="${team}">${team}</option>`).join('');
  select.value=Object.keys(state.calendar.data?.teams||{}).includes(current)?current:'ALL';
}

function renderCalendar() {
  const source=$('#calendarSource'); if(!source)return;
  $('#calendarSeason').value=state.calendar.season; $('#calendarWindow').value=state.calendar.window; $('#offNightThreshold').value=String(state.calendar.threshold); $('#pairSort').value=state.calendar.sort;
  $('#calendarSparseLabel').textContent=`${state.calendar.threshold} games or fewer`;
  if(state.calendar.status==='loading'){
    source.textContent='Loading all 32 official NHL team schedules and deduplicating games...';
    ['#bestPairSpotlight','#worstPairSpotlight','#teamPairLookupResults','#starPairGrid','#goaliePairGrid','#pairRankingList','#trioList','#teamScheduleProfiles','#keeperPartnerGrid','#teamPlanResults','#weeklyCalendar'].forEach(selector=>{const el=$(selector);if(el)el.innerHTML='<div class="calendar-loading">Calculating schedule fit...</div>';});
    return;
  }
  if(!calendarDatasetValid(state.calendar.data)){
    const message=state.calendar.status==='error'?`Schedule unavailable: ${state.calendar.error}`:'The schedule page is ready. Deploy FDA or use the direct-load button to import the official NHL schedule.';
    source.textContent=message;
    $('#calendarGameCount').textContent='-'; $('#calendarPairCount').textContent='-'; $('#calendarSparseDates').textContent='-'; $('#calendarBestCoverage').textContent='-';
    return;
  }
  const data=state.calendar.data, range=calendarRange(), counts=leagueCountsForRange(range), sparseDates=Object.values(counts).filter(count=>count<=state.calendar.threshold).length;
  source.textContent=`${data.source} · generated ${new Date(data.generatedAt).toLocaleString('en-US')}`;
  $('#calendarGameCount').textContent=data.metadata.gameCount.toLocaleString('en-US'); $('#calendarDateRange').textContent=`${compactDate(data.metadata.startDate)} - ${compactDate(data.metadata.endDate)}`;
  $('#calendarPairCount').textContent=state.calendar.pairs.length.toLocaleString('en-US'); $('#calendarSparseDates').textContent=sparseDates; $('#calendarBestCoverage').textContent=state.calendar.pairs[0]?.coverage||'-';
  populateCalendarTeamFilter(); populateTeamPairLookup();
  const best=sortedCalendarPairs()[0]||state.calendar.pairs[0], worst=[...state.calendar.pairs].sort((a,b)=>a.score-b.score)[0];
  renderPairSpotlight($('#bestPairSpotlight'),best,'BEST TWO-TEAM FIT'); renderPairSpotlight($('#worstPairSpotlight'),worst,'WORST TWO-TEAM FIT');
  renderTeamPairLookup(); renderStarPairs(); renderGoaliePairs(); renderPairRankings(); renderTrios(); renderTeamProfiles(); renderRosterFit(); renderKeeperPartners(); renderTeamPlans(); renderWeeklyCalendar();
}


function historyNumber(value, digits = 0) {
  return number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function historyRecordCard(label, player, statKey, suffix = '') {
  if (!player) return `<article class="panel history-record-card"><span>${safeText(label)}</span><strong>—</strong><small>Record unavailable</small></article>`;
  const stat = statKey === 'savePct' ? historyNumber(player[statKey] * (player[statKey] <= 1 ? 100 : 1), 1) : historyNumber(player[statKey], statKey === 'pointsPerGame' ? 2 : 0);
  const context = player.seasonId ? `${player.name} · ${player.seasonLabel}` : player.name;
  return `<button class="panel history-record-card" data-history-player="${player.id}" type="button">
    <span>${safeText(label)}</span><strong>${stat}${safeText(suffix)}</strong><small>${safeText(context)}</small>
    <img src="${safeText(player.headshot)}" alt="" onerror="this.style.display='none'" />
  </button>`;
}

function historyTabConfig() {
  const leaders = state.history.data?.leaders || {};
  if (state.history.tab === 'seasons') return {
    eyebrow:'GREATEST SINGLE SEASONS', title:'Highest-scoring seasons in NHL history', description:'Each row is one regular season, not a career total.',
    main:leaders.seasonPoints || [], sideOne:leaders.seasonGoals || [], sideTwo:leaders.seasonAssists || [],
    sideOneEyebrow:'GOAL EXPLOSIONS', sideOneTitle:'Most goals in a season', sideTwoEyebrow:'PLAYMAKING PEAKS', sideTwoTitle:'Most assists in a season', type:'skater', sideOneKey:'goals', sideTwoKey:'assists'
  };
  if (state.history.tab === 'goalies') return {
    eyebrow:'GOALTENDING ROYALTY', title:'Career wins leaders', description:'Regular-season goaltending leaders from the official NHL archive.',
    main:leaders.goalieCareerWins || [], sideOne:leaders.goalieCareerShutouts || [], sideTwo:leaders.goalieSeasonWins || [],
    sideOneEyebrow:'CLEAN SHEETS', sideOneTitle:'Career shutouts', sideTwoEyebrow:'WINNINGEST SEASONS', sideTwoTitle:'Wins in one season', type:'goalie', sideOneKey:'shutouts', sideTwoKey:'wins'
  };
  if (state.history.tab === 'defence') {
    const durability = [...(leaders.defenseCareer || [])].sort((a,b)=>b.gamesPlayed-a.gamesPlayed).slice(0,12);
    return {
      eyebrow:'DEFENCE LEGENDS', title:'Career points by defencemen', description:'Offensive production from the blue line across NHL history.',
      main:leaders.defenseCareer || [], sideOne:leaders.defenseSeasons || [], sideTwo:durability,
      sideOneEyebrow:'PEAK SEASONS', sideOneTitle:'Best scoring seasons by D', sideTwoEyebrow:'LONGEVITY', sideTwoTitle:'Games played by D', type:'skater', sideOneKey:'points', sideTwoKey:'gamesPlayed'
    };
  }
  return {
    eyebrow:'ALL-TIME SCORING', title:'Career points leaders', description:'Regular-season totals across NHL history.',
    main:leaders.careerPoints || [], sideOne:leaders.careerGoals || [], sideTwo:leaders.careerAssists || [],
    sideOneEyebrow:'GOAL SCORERS', sideOneTitle:'Career goals', sideTwoEyebrow:'PLAYMAKERS', sideTwoTitle:'Career assists', type:'skater', sideOneKey:'goals', sideTwoKey:'assists'
  };
}

function renderHistoryTable(rows, type) {
  const head = $('#historyTableHead');
  const list = $('#historyLeaderList');
  if (!head || !list) return;
  if (type === 'goalie') {
    head.innerHTML = '<span>Player</span><span>GP</span><span>W</span><span>SO</span><span>SV%</span><span>GAA</span>';
    list.innerHTML = rows.slice(0,25).map((player,index)=>{
      const savePct = player.savePct ? (player.savePct <= 1 ? player.savePct * 100 : player.savePct) : 0;
      return `<button class="history-row" data-history-player="${player.id}" type="button">
        <span class="history-rank">${index+1}</span><img src="${safeText(player.headshot)}" alt="" onerror="this.style.opacity=.08" />
        <span class="history-player-copy"><strong>${safeText(player.name)}</strong><small>${safeText(player.seasonId ? player.seasonLabel : 'Career')} · ${safeText(player.team || 'NHL')}</small></span>
        <span class="history-row-stats"><span><b>${historyNumber(player.gamesPlayed)}</b><small>GP</small></span><span><b>${historyNumber(player.wins)}</b><small>W</small></span><span><b>${historyNumber(player.shutouts)}</b><small>SO</small></span><span><b>${savePct ? historyNumber(savePct,1) : '—'}</b><small>SV%</small></span><span><b>${player.goalsAgainstAverage ? historyNumber(player.goalsAgainstAverage,2) : '—'}</b><small>GAA</small></span></span>
        <span class="history-primary-stat"><strong>${historyNumber(player.wins)}</strong><small>wins</small></span>
      </button>`;
    }).join('') || '<div class="history-error">No goalie history was returned.</div>';
    return;
  }
  head.innerHTML = '<span>Player</span><span>GP</span><span>G</span><span>A</span><span>PTS</span><span>P/GP</span>';
  list.innerHTML = rows.slice(0,25).map((player,index)=>`<button class="history-row" data-history-player="${player.id}" type="button">
    <span class="history-rank">${index+1}</span><img src="${safeText(player.headshot)}" alt="" onerror="this.style.opacity=.08" />
    <span class="history-player-copy"><strong>${safeText(player.name)}</strong><small>${safeText(player.seasonId ? player.seasonLabel : 'Career')} · ${safeText(player.team || 'NHL')} · ${safeText(player.position || '')}</small></span>
    <span class="history-row-stats"><span><b>${historyNumber(player.gamesPlayed)}</b><small>GP</small></span><span><b>${historyNumber(player.goals)}</b><small>G</small></span><span><b>${historyNumber(player.assists)}</b><small>A</small></span><span><b>${historyNumber(player.points)}</b><small>PTS</small></span><span><b>${historyNumber(player.pointsPerGame,2)}</b><small>P/GP</small></span></span>
    <span class="history-primary-stat"><strong>${historyNumber(player.points)}</strong><small>points</small></span>
  </button>`).join('') || '<div class="history-error">No skater history was returned.</div>';
}

function renderHistoryMiniList(target, rows, key) {
  if (!target) return;
  target.innerHTML = rows.slice(0,12).map((player,index)=>{
    let value = player[key];
    if (key === 'savePct') value = number(value) <= 1 ? number(value) * 100 : number(value);
    const digits = ['savePct','goalsAgainstAverage','pointsPerGame'].includes(key) ? (key === 'goalsAgainstAverage' ? 2 : 1) : 0;
    return `<button class="history-mini-row" data-history-player="${player.id}" type="button"><span>${index+1}</span><img src="${safeText(player.headshot)}" alt="" onerror="this.style.opacity=.08"/><span><strong>${safeText(player.name)}</strong><small>${safeText(player.seasonId ? player.seasonLabel : 'Career')} · ${safeText(player.team || 'NHL')}</small></span><b>${historyNumber(value,digits)}</b></button>`;
  }).join('') || '<div class="calendar-loading">No records returned.</div>';
}

function fantasySeasonLabel(season) {
  const raw=String(season||'');
  return raw.length===8?`${raw.slice(0,4)}-${raw.slice(6)}`:raw;
}

function fantasyHistoryEntry() {
  return state.history.fantasyCache.get(state.history.fantasySeason)||null;
}

function fantasyMinimumGames(player) { return positionGroup(player)==='G'?5:10; }

function renderFantasyHistory() {
  const source=$('#historySource'), status=$('#historyStatus'), updated=$('#historyUpdated');
  const entry=fantasyHistoryEntry();
  $('#fantasyHistoryControls').hidden=false;
  $('#historySecondaryGrid').hidden=true;
  $('#historyRecords').hidden=false;
  $('#fantasyHistorySeason').value=state.history.fantasySeason;
  $('#fantasyHistoryPosition').value=state.history.fantasyPosition;
  $('#historyTableEyebrow').textContent='YOUR FANTRAX SCORING';
  $('#historyTableTitle').textContent=`${fantasySeasonLabel(state.history.fantasySeason)} fantasy FPG leaders`;
  $('#historyTableDescription').textContent='Season-by-season rankings calculated with the scoring settings currently saved in FDA.';
  if(state.history.fantasyStatus==='loading'){
    source.textContent=`Loading ${fantasySeasonLabel(state.history.fantasySeason)} official season reports…`;
    updated.textContent='Calculating every returned player with your current scoring rules.';
    status.textContent='Loading'; status.className='status-badge';
    $('#historyLeaderList').innerHTML='<div class="calendar-loading">Building the fantasy leaderboard…</div>';
    $('#historyRecords').innerHTML='';
    return;
  }
  if(state.history.fantasyStatus==='error'){
    source.textContent='Fantasy season data could not be loaded.';
    updated.textContent=state.history.fantasyError;
    status.textContent='Unavailable'; status.className='status-badge';
    $('#historyLeaderList').innerHTML=`<div class="history-error">${safeText(state.history.fantasyError)}</div>`;
    $('#historyRecords').innerHTML='';
    return;
  }
  if(!entry){
    source.textContent='Choose a season to build its fantasy leaderboard.';
    updated.textContent='Official NHL season reports are requested only when needed.';
    status.textContent='Waiting'; status.className='status-badge';
    $('#historyLeaderList').innerHTML='<div class="calendar-loading">Select Fantasy FPG to load this season.</div>';
    $('#historyRecords').innerHTML='';
    return;
  }
  const exact=Boolean(entry.exact);
  const coverage=exact
    ? 'Exact mode: Gamecenter first-star, fight, shootout and hat-trick events are included.'
    : 'Tracked mode: official season-report categories are included; first-star and Gordie Howe bonuses are marked unavailable rather than counted as zero.';
  $('#fantasyHistoryCoverage').textContent=coverage;
  source.textContent=entry.source||'Official NHL season reports';
  updated.textContent=`Calculated ${new Date(entry.generatedAt).toLocaleString('en-US')} · ${entry.players.length} players`;
  status.textContent=exact?'Exact FPG':'Tracked FPG'; status.className='status-badge';
  let players=entry.players.filter(player=>player.gamesPlayed>=fantasyMinimumGames(player));
  if(state.history.fantasyPosition!=='ALL')players=players.filter(player=>positionGroup(player)===state.history.fantasyPosition);
  players.sort((a,b)=>b.fpg-a.fpg||b.fantasyPoints-a.fantasyPoints||b.gamesPlayed-a.gamesPlayed);
  const totalLeaders=[...entry.players].filter(player=>player.gamesPlayed>=fantasyMinimumGames(player)).sort((a,b)=>b.fantasyPoints-a.fantasyPoints);
  const forward=players.find(player=>positionGroup(player)==='F')||entry.players.filter(player=>positionGroup(player)==='F'&&player.gamesPlayed>=10).sort((a,b)=>b.fpg-a.fpg)[0];
  const defence=players.find(player=>positionGroup(player)==='D')||entry.players.filter(player=>positionGroup(player)==='D'&&player.gamesPlayed>=10).sort((a,b)=>b.fpg-a.fpg)[0];
  const goalie=players.find(player=>positionGroup(player)==='G')||entry.players.filter(player=>positionGroup(player)==='G'&&player.gamesPlayed>=5).sort((a,b)=>b.fpg-a.fpg)[0];
  const top=players[0];
  const fantasyCard=(label,player,value,label2)=>`<article class="panel history-record-card"><span>${safeText(label)}</span><strong>${player?historyNumber(value(player),2):'—'}</strong><small>${player?safeText(`${player.name} · ${player.team} · ${label2}`):'No eligible player'}</small>${player?`<img src="${safeText(headshotUrl(player))}" alt="" onerror="this.style.display='none'"/>`:''}</article>`;
  $('#historyRecords').innerHTML=[
    fantasyCard('Overall FPG',top,p=>p.fpg,'FP/G'),
    fantasyCard('Forward FPG',forward,p=>p.fpg,'FP/G'),
    fantasyCard('Defence FPG',defence,p=>p.fpg,'FP/G'),
    fantasyCard('Goalie FPG',goalie,p=>p.fpg,'FP/G')
  ].join('');
  $('#historyTableHead').innerHTML='<span>Player</span><span>GP</span><span>FPTS</span><span>FPG</span><span>1st stars</span><span>Coverage</span>';
  $('#historyLeaderList').innerHTML=players.slice(0,60).map((player,index)=>{
    const stars=exact?historyNumber(player.stats?.firstStars):'—';
    return `<article class="history-row fantasy-history-row"><span class="history-rank">${index+1}</span><img src="${safeText(headshotUrl(player))}" alt="" onerror="this.style.opacity=.08"/><span class="history-player-copy"><strong>${safeText(player.name)}</strong><small>${safeText(player.team)} · ${safeText(positionGroup(player))} · minimum ${fantasyMinimumGames(player)} GP</small></span><span class="history-row-stats"><span><b>${historyNumber(player.gamesPlayed)}</b><small>GP</small></span><span><b>${historyNumber(player.fantasyPoints,1)}</b><small>FPTS</small></span><span><b>${historyNumber(player.fpg,2)}</b><small>FPG</small></span><span><b>${stars}</b><small>1★</small></span><span><b>${exact?'Exact':'Tracked'}</b><small>mode</small></span></span><span class="history-primary-stat"><strong>${historyNumber(player.fpg,2)}</strong><small>FPG</small></span></article>`;
  }).join('')||'<div class="history-error">No players met the minimum-games filter for this position.</div>';
}

function renderHistory() {
  const source = $('#historySource');
  if (!source) return;
  $$('.history-tab').forEach(button=>button.classList.toggle('active',button.dataset.historyTab===state.history.tab));
  if(state.history.tab==='fantasy'){renderFantasyHistory();return;}
  $('#fantasyHistoryControls').hidden=true;
  $('#historySecondaryGrid').hidden=false;
  $('#historyRecords').hidden=false;
  const status = $('#historyStatus');
  const updated = $('#historyUpdated');
  if (state.history.status === 'loading') {
    source.textContent = 'Loading career and single-season leaderboards from NHL.com…';
    updated.textContent = 'This request runs through the FDA server route.';
    status.textContent = 'Loading';
    status.className = 'status-badge';
    $('#historyLeaderList').innerHTML = '<div class="calendar-loading">Reading the NHL historical archive…</div>';
    return;
  }
  if (state.history.status === 'error' || !state.history.data) {
    source.textContent = state.history.status === 'error' ? 'Historical data could not be loaded.' : 'Official NHL historical reports are ready to load.';
    updated.textContent = state.history.error || 'Open this page after deployment to request the official archive.';
    status.textContent = state.history.status === 'error' ? 'Unavailable' : 'Waiting';
    status.className = 'status-badge';
    if (state.history.status === 'error') $('#historyLeaderList').innerHTML = `<div class="history-error">${safeText(state.history.error)}</div>`;
    return;
  }
  const data = state.history.data;
  source.textContent = data.source || 'Official NHL historical reports';
  updated.textContent = `Updated ${new Date(data.generatedAt).toLocaleString('en-US')}`;
  status.textContent = 'Official NHL';
  status.className = 'status-badge';
  const records = data.records || {};
  $('#historyRecords').innerHTML = [
    historyRecordCard('Career points',records.careerPoints,'points'),
    historyRecordCard('Career goals',records.careerGoals,'goals'),
    historyRecordCard('Single-season points',records.seasonPoints,'points'),
    historyRecordCard('Goalie wins',records.goalieWins,'wins')
  ].join('');
  const config = historyTabConfig();
  $('#historyTableEyebrow').textContent = config.eyebrow;
  $('#historyTableTitle').textContent = config.title;
  $('#historyTableDescription').textContent = config.description;
  $('#historySideOneEyebrow').textContent = config.sideOneEyebrow;
  $('#historySideOneTitle').textContent = config.sideOneTitle;
  $('#historySideTwoEyebrow').textContent = config.sideTwoEyebrow;
  $('#historySideTwoTitle').textContent = config.sideTwoTitle;
  renderHistoryTable(config.main,config.type);
  renderHistoryMiniList($('#historySideOne'),config.sideOne,config.sideOneKey);
  renderHistoryMiniList($('#historySideTwo'),config.sideTwo,config.sideTwoKey);
}

async function loadHistoricalFantasySeason({ force=false }={}) {
  const season=state.history.fantasySeason;
  if(state.history.fantasyStatus==='loading')return;
  if(state.history.fantasyCache.has(season)&&!force){state.history.fantasyStatus='ready';renderHistory();return;}
  state.history.fantasyStatus='loading'; state.history.fantasyError=''; renderHistory();
  try{
    let payload=null, exact=false;
    for(const path of [`data/fantasy-history/${season}.json`,`data/players.json`]){
      if(payload)break;
      try{
        const cachedResponse=await fetch(`${path}?t=${Date.now()}`,{cache:'no-store'});
        if(cachedResponse.ok){
          const cached=await cachedResponse.json();
          if(String(cached.season)===season&&Array.isArray(cached.players)&&cached.players.length>=250){
            payload=cached;
            exact=Boolean(cached.metadata?.exactSpecialEventsIncluded)||String(cached.metadata?.source||'').toLowerCase().includes('gamecenter');
          }
        }
      }catch{}
    }
    if(!payload){
      const response=await fetch(`/api/players?season=${encodeURIComponent(season)}&t=${Date.now()}`,{cache:'no-store'});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||`${response.status} ${response.statusText}`);
      payload=body;
      exact=Boolean(body.metadata?.exactSpecialEventsIncluded);
    }
    if(payload.season&&String(payload.season)!==season)throw new Error(`The player route returned ${fantasySeasonLabel(payload.season)} instead of ${fantasySeasonLabel(season)}.`);
    if(!Array.isArray(payload.players)||payload.players.length<250)throw new Error(`Only ${payload.players?.length||0} player records were returned for ${fantasySeasonLabel(season)}.`);
    const players=payload.players.map(normalizeSyncedPlayer).filter(player=>player.gamesPlayed>0);
    state.history.fantasyCache.set(season,{season,players,exact,source:payload.metadata?.source||payload.source||'Official NHL season reports',generatedAt:payload.generatedAt||payload.metadata?.generatedAt||new Date().toISOString(),note:payload.metadata?.note||''});
    state.history.fantasyStatus='ready';
    addDiagnostic(`${fantasySeasonLabel(season)} fantasy leaderboard`,`${players.length} players calculated with the current FDA scoring rules. ${exact?'Gamecenter event bonuses included.':'Report-only special-event gaps are labelled.'}`,'ok',exact?'Exact FPG':'Tracked FPG');
  }catch(error){
    state.history.fantasyStatus='error'; state.history.fantasyError=error.message;
    addDiagnostic('Fantasy history',error.message,'warn','Unavailable');
  }
  renderHistory();
}

async function loadHistoricalData({ force = false } = {}) {
  if (state.history.status === 'loading') return;
  if (state.history.data && !force) { renderHistory(); return; }
  state.history.status = 'loading';
  state.history.error = '';
  renderHistory();
  try {
    const response = await fetch(`/api/historical?t=${Date.now()}`, { cache:'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
    if (!payload?.leaders?.careerPoints?.length || !payload?.leaders?.goalieCareerWins?.length) throw new Error('The NHL historical response was incomplete.');
    state.history.data = payload;
    state.history.status = 'ready';
    addDiagnostic('Historical NHL archive', 'Career leaders, single-season records, goalies and defencemen loaded from official NHL reports.', 'ok', 'History ready');
  } catch (error) {
    state.history.status = 'error';
    state.history.error = error.message;
    addDiagnostic('Historical NHL archive', error.message, 'error', 'Unavailable');
  }
  renderHistory();
}

function inchesLabel(value) {
  const inches = number(value);
  if (!inches) return '';
  return `${Math.floor(inches/12)}′${inches%12}″`;
}

async function openHistoricalPlayer(id) {
  const playerId = number(id);
  if (!playerId) return;
  const cached = state.history.detailCache.get(playerId);
  showDialog('Loading historical career…','<div class="calendar-loading">Retrieving the official season-by-season record.</div>','NHL HISTORY');
  try {
    let player = cached;
    if (!player) {
      const response = await fetch(`/api/historical?playerId=${playerId}&t=${Date.now()}`, { cache:'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
      player = payload.player;
      state.history.detailCache.set(playerId,player);
    }
    const goalie = String(player.position).toUpperCase() === 'G' || player.seasonTotals.some(row=>row.wins || row.savePct);
    const location = [player.birthCity,player.birthStateProvince,player.birthCountry].filter(Boolean).join(', ');
    const meta = [player.position,player.shootsCatches ? `${player.shootsCatches} shot/catch` : '', inchesLabel(player.heightInInches), player.weightInPounds ? `${player.weightInPounds} lb` : ''].filter(Boolean).join(' · ');
    const header = goalie ? '<span>Season</span><span>Team</span><span>GP</span><span>W</span><span>SO</span><span>SV%</span>' : '<span>Season</span><span>Team</span><span>GP</span><span>G</span><span>A</span><span>PTS</span>';
    const rows = player.seasonTotals.map(row=>goalie
      ? `<div class="history-career-row"><span>${safeText(row.seasonLabel)}</span><span>${safeText(row.teamAbbrev || row.team)}</span><span>${historyNumber(row.gamesPlayed)}</span><span>${historyNumber(row.wins)}</span><span>${historyNumber(row.shutouts)}</span><span>${row.savePct ? historyNumber((row.savePct<=1?row.savePct*100:row.savePct),1) : '—'}</span></div>`
      : `<div class="history-career-row"><span>${safeText(row.seasonLabel)}</span><span>${safeText(row.teamAbbrev || row.team)}</span><span>${historyNumber(row.gamesPlayed)}</span><span>${historyNumber(row.goals)}</span><span>${historyNumber(row.assists)}</span><span>${historyNumber(row.points)}</span></div>`
    ).join('');
    $('#dialogTitle').textContent = player.name;
    $('#dialogEyebrow').textContent = 'OFFICIAL NHL CAREER';
    $('#dialogBody').innerHTML = `<div class="history-dialog-profile"><img src="${safeText(player.headshot)}" alt="" onerror="this.style.opacity=.08"/><div><strong>${safeText(player.name)}</strong><span>${safeText(meta || 'Historical NHL player')}</span><span>${safeText(location || player.birthDate || '')}</span></div></div><div class="history-career-table"><div class="history-career-row header">${header}</div>${rows || '<div class="history-error">No season totals were returned for this player.</div>'}</div>`;
  } catch (error) {
    $('#dialogTitle').textContent = 'Career unavailable';
    $('#dialogBody').innerHTML = `<div class="history-error">${safeText(error.message)}</div>`;
  }
}

function navigate(route) {
  state.route=route;
  $$('.page').forEach(page=>page.classList.toggle('active',page.id===`page-${route}`));
  $$('[data-route]').forEach(button=>button.classList.toggle('active',button.dataset.route===route&&(button.classList.contains('nav-link')||button.classList.contains('mobile-link'))));
  window.scrollTo({top:0,behavior:'smooth'});
  if(route==='lab')renderLab(); if(route==='draft')renderDraft(); if(route==='calendar'){renderCalendar();if(state.calendar.status==='idle')loadCalendarData();} if(route==='history'){renderHistory();if(state.history.tab==='fantasy')loadHistoricalFantasySeason();else if(state.history.status==='idle')loadHistoricalData();}
}

function openPlayer(id) { state.selectedPlayerId=number(id); navigate('lab'); renderLab(); }
function showDialog(title,body,eyebrow='FDA'){ $('#dialogTitle').textContent=title; $('#dialogEyebrow').textContent=eyebrow; $('#dialogBody').innerHTML=body; $('#messageDialog').showModal(); }

async function importSalaryMasterFile(file){
  if(!file)return;
  try{
    const text=await file.text();
    const payload=file.name.toLowerCase().endsWith('.json')?JSON.parse(text):parseCsvRows(text);
    const rows=salaryRowsFromPayload(payload);
    const records=rows.map(normalizeSalaryRecord).filter(row=>row.name&&row.team);
    if(records.length<100)throw new Error(`Only ${records.length} usable salary records were found. Choose the complete JSON or CSV export, not the completion note.`);
    persistSalaryOverride(records,`Imported ${file.name}`);
    state.salary.records=records;
    state.salary.metadata={scope:'browser-import',recordCount:records.length,zeroMeansUnsigned:true};
    state.salary.source=`Imported ${file.name}`;
    state.salary.status='ready'; state.salary.error=''; rebuildSalaryIndex();
    applySalaryDataToPlayers();
    addDiagnostic('Salary master imported',`${records.length} player salary records are now available to the roster experiment centre.`,'ok',`${records.length} records`);
    renderDraft(); applyPlayerFilters(); renderLab(); renderDiagnostics();
    showDialog('Salary master ready',`<p><strong>${records.length.toLocaleString('en-US')} records</strong> were imported. Open-slot recommendations now use the complete static salary table.</p>`,'SALARY MASTER');
  }catch(error){
    showDialog('Salary import failed',`<p>${safeText(error.message)}</p><p>Use the complete <code>SALARY_CAP_SPACE.json</code> or CSV export.</p>`,'SALARY MASTER');
  }finally{
    const input=$('#salaryMasterImport'); if(input)input.value='';
  }
}

function bindEvents() {
  document.addEventListener('click',event=>{
    const route=event.target.closest('[data-route]')?.dataset.route; if(route)navigate(route);
    const playerId=event.target.closest('[data-open-player]')?.dataset.openPlayer; if(playerId)openPlayer(playerId);
    const historyPlayerId=event.target.closest('[data-history-player]')?.dataset.historyPlayer; if(historyPlayerId)openHistoricalPlayer(historyPlayerId);
    const historyTab=event.target.closest('[data-history-tab]')?.dataset.historyTab; if(historyTab){state.history.tab=historyTab;renderHistory();if(historyTab==='fantasy')loadHistoricalFantasySeason();else if(state.history.status==='idle')loadHistoricalData();}
    const addId=event.target.closest('[data-add-roster]')?.dataset.addRoster; if(addId){
      const player=state.players.find(item=>item.id===number(addId));
      if(!player)return;
      const group=positionGroup(player); const groupCount=activeRosterPlayers().filter(item=>positionGroup(item)===group).length;
      if(activeRosterCount()>=23)return showDialog('Roster full','<p>The active roster already contains 23 players. Protected minors do not count toward that limit.</p>');
      if(groupCount>=ACTIVE_ROSTER_TARGETS[group])return showDialog(`${group==='F'?'Forward':group==='D'?'Defence':'Goalie'} slots full`,`<p>Your roster already has the required ${ACTIVE_ROSTER_TARGETS[group]} ${group==='F'?'forwards':group==='D'?'defencemen':'goalies'}.</p>`);
      if(!number(player.capHit))return showDialog(player.salaryStatus==='unsigned'?'Unsigned player':'Salary required',`<p>${safeText(player.name)} does not have a signed salary match in the loaded master. FDA will not treat a missing or $0 contract as a free player.</p>`);
      if(!draftPlayerCanBeAdded(player))return showDialog('Move does not fit',`<p>Adding ${safeText(player.name)} would either exceed the position limit or leave too little cap room to fill every remaining spot at league minimum.</p>`);
      if(!state.roster.includes(number(addId)))state.roster.push(number(addId));
      invalidateTeamPlans();saveRoster();renderDraft();renderCalendar();
    }
    const removeId=event.target.closest('[data-remove-roster]')?.dataset.removeRoster; if(removeId){const player=state.players.find(item=>item.id===number(removeId));if(player?.keeper)return;state.roster=state.roster.filter(id=>id!==number(removeId));invalidateTeamPlans();saveRoster();renderDraft();renderCalendar();}
    const editPlayer=event.target.closest('[data-edit-player]')?.dataset.editPlayer; if(editPlayer){state.salary.editorPlayerId=number(editPlayer);renderSalaryPredictionEditor();}
    if(event.target.closest('#savePlayerData'))saveSelectedPlayerData();
    if(event.target.closest('#clearPlayerData'))clearSelectedPlayerData();
    if(event.target.closest('#downloadSalaryUpdates'))downloadUpdatedSalaryMaster();
    const budgetPlan=event.target.closest('[data-budget-plan]')?.dataset.budgetPlan; if(budgetPlan){state.salary.plan=budgetPlan;saveSalarySettings();renderDraft();}
    const slotTarget=event.target.closest('[data-select-budget-slot]')?.dataset.selectBudgetSlot; if(slotTarget){const [group,index]=slotTarget.split(':');state.salary.selectedSlot={group,index:number(index)};renderDraft();}
    if(event.target.closest('#resetSelectedSlotBudget')){const plan=buildBudgetPlan();const info=selectedSlotBudgetInfo(plan);if(info.key)delete state.salary.slotOverrides[info.key];saveSalarySettings();renderDraft();}
    const calendarPair=event.target.closest('[data-calendar-pair]')?.dataset.calendarPair; if(calendarPair){state.calendar.selectedPair=calendarPair.split('-');state.calendar.weekIndex=0;renderCalendar();document.querySelector('.calendar-board-section')?.scrollIntoView({behavior:'smooth',block:'start'});}
  });
  $('#refreshData').addEventListener('click',()=>refreshAllData({forceLive:true}));
  $('#dataRefreshButton').addEventListener('click',()=>refreshAllData({forceLive:true}));
  $('#seasonSelect').addEventListener('change',event=>{state.season=event.target.value;refreshAllData();});
  ['playerSearch','positionFilter','teamFilter','sortFilter'].forEach(id=>$('#'+id).addEventListener(id==='playerSearch'?'input':'change',()=>{state.visibleCount=60;applyPlayerFilters();}));
  $('#clearSearch').addEventListener('click',()=>{$('#playerSearch').value='';applyPlayerFilters();});
  $('#loadMore').addEventListener('click',()=>{state.visibleCount+=60;renderPlayers();});
  $$('.lab-tab').forEach(button=>button.addEventListener('click',()=>{$$('.lab-tab').forEach(x=>x.classList.remove('active'));button.classList.add('active');$$('.lab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`lab-${button.dataset.labtab}`));if(button.dataset.labtab==='edge'){const player=selectedPlayer();if(player&&!state.edgeCache.has(`${state.season}:${player.id}`))loadEdgeDataForPlayer(player);}}));
  $('#watchPlayer').addEventListener('click',()=>{const player=selectedPlayer();if(!player)return;state.watchlist.has(player.id)?state.watchlist.delete(player.id):state.watchlist.add(player.id);storage.setItem('fda-watchlist',JSON.stringify([...state.watchlist]));renderLab();});
  $('#refreshSchedule').addEventListener('click',()=>{const player=selectedPlayer();if(player)loadSchedule(player);});
  $('#loadEdgeData').addEventListener('click',()=>{const player=selectedPlayer();if(player)loadEdgeDataForPlayer(player);});
  $('#refreshCalendar').addEventListener('click',()=>loadCalendarData({force:true}));
  $('#refreshHistory').addEventListener('click',()=>state.history.tab==='fantasy'?loadHistoricalFantasySeason({force:true}):loadHistoricalData({force:true}));
  $('#directCalendarLoad').addEventListener('click',()=>loadCalendarData({force:true,direct:true}));
  $('#calendarSeason').addEventListener('change',event=>{state.calendar.season=event.target.value;state.calendar.data=null;state.calendar.status='idle';state.calendar.visiblePairs=30;loadCalendarData({force:true});});
  $('#calendarWindow').addEventListener('change',event=>{state.calendar.window=event.target.value;state.calendar.visiblePairs=30;invalidateTeamPlans();recalculateCalendarAnalysis();renderCalendar();});
  $('#offNightThreshold').addEventListener('change',event=>{state.calendar.threshold=number(event.target.value);state.calendar.visiblePairs=30;invalidateTeamPlans();recalculateCalendarAnalysis();renderCalendar();});
  $('#calendarTeam').addEventListener('change',event=>{state.calendar.focusTeam=event.target.value;state.calendar.visiblePairs=30;renderCalendar();});
  $('#teamPairLookup').addEventListener('change',event=>{state.calendar.lookupTeam=event.target.value;storage.setItem('fda-calendar-lookup-team',state.calendar.lookupTeam);renderCalendar();});
  $('#pairSort').addEventListener('change',event=>{state.calendar.sort=event.target.value;state.calendar.visiblePairs=30;renderCalendar();});
  $('#loadMorePairs').addEventListener('click',()=>{state.calendar.visiblePairs+=30;renderPairRankings();});
  $('#rosterFitPosition').addEventListener('change',()=>renderRosterFit());
  $('#generateTeamPlans').addEventListener('click',()=>{if(!calendarDatasetValid(state.calendar.data))return showDialog('Schedule required','<p>Load the official NHL schedule before generating roster plans.</p>');generateTeamPlans();});
  $('#calendarPrevWeek').addEventListener('click',()=>{state.calendar.weekIndex=Math.max(0,state.calendar.weekIndex-1);renderWeeklyCalendar();});
  $('#calendarNextWeek').addEventListener('click',()=>{state.calendar.weekIndex+=1;renderWeeklyCalendar();});
  $('#resetRoster').addEventListener('click',()=>{restoreKeeperRoster();invalidateTeamPlans();renderDraft();renderCalendar();});
  $('#recommendationSort').addEventListener('change',event=>{state.salary.recommendationSort=event.target.value;saveSalarySettings();renderDraft();});
  $('#draftSearch').addEventListener('input',event=>{state.salary.draftSearch=event.target.value;renderDraftPool(buildBudgetPlan());});
  $('#draftPosition').addEventListener('change',event=>{state.salary.draftPosition=event.target.value;renderDraftPool(buildBudgetPlan());});
  $('#draftSort').addEventListener('change',event=>{state.salary.draftSort=event.target.value;renderDraftPool(buildBudgetPlan());});
  $('#draftFitsSlot').addEventListener('change',event=>{state.salary.draftFitsSlot=event.target.checked;renderDraftPool(buildBudgetPlan());});
  $('#salaryEditorSearch').addEventListener('input',event=>{state.salary.editorSearch=event.target.value;renderSalaryPredictionEditor();});
  $('#fantasyHistorySeason').addEventListener('change',event=>{state.history.fantasySeason=event.target.value;loadHistoricalFantasySeason();});
  $('#fantasyHistoryPosition').addEventListener('change',event=>{state.history.fantasyPosition=event.target.value;renderHistory();});
  $('#restoreRules').addEventListener('click',()=>{state.rules=structuredClone(DEFAULT_RULES);saveRules();invalidateTeamPlans();recalculateAll();});
  document.addEventListener('change',event=>{
    if(event.target.id==='selectedSlotMax'){
      const plan=buildBudgetPlan(); const info=selectedSlotBudgetInfo(plan);
      if(info.key){state.salary.slotOverrides[info.key]=Math.min(info.hardMax,Math.max(NHL_LEAGUE_MINIMUM,number(event.target.value)));saveSalarySettings();renderDraft();}
    }
  });
  document.addEventListener('input',event=>{
    const salaryInput=event.target.closest('[data-salary-estimate]');
    if(salaryInput){state.salary.estimates[salaryInput.dataset.salaryEstimate]=Math.max(NHL_LEAGUE_MINIMUM,number(salaryInput.value));saveSalarySettings();renderDraft();return;}
    const input=event.target.closest('[data-rule-key]');if(!input)return;state.rules[input.dataset.ruleType][input.dataset.ruleKey].value=number(input.value);saveRules();invalidateTeamPlans();state.history.fantasyCache.clear();state.history.fantasyStatus='idle';state.players=state.players.map(calculatePlayer);applySalaryDataToPlayers();renderDashboard();applyPlayerFilters();renderLab();renderDraft();
  });
  $('#closeDialog').addEventListener('click',()=>$('#messageDialog').close());
}

bindEvents();
if (OFFLINE_PREVIEW) addDiagnostic('Preview query ignored', 'Version 3 no longer replaces the NHL directory with three sample players.', 'warn', 'Live directory required');
refreshAllData();
