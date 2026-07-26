import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SEASON = String(process.env.NHL_SEASON || '20252026');
const NHL_WEB = 'https://api-web.nhle.com/v1';
const NHL_STATS = 'https://api.nhle.com/stats/rest/en';
const CONCURRENCY = Math.max(1, Math.min(16, Number(process.env.NHL_SYNC_CONCURRENCY || 8)));
const TEAMS = ['ANA','BOS','BUF','CAR','CBJ','CGY','CHI','COL','DAL','DET','EDM','FLA','LAK','MIN','MTL','NJD','NSH','NYI','NYR','OTT','PHI','PIT','SEA','SJS','STL','TBL','TOR','UTA','VAN','VGK','WPG','WSH'];
const FINAL_STATES = new Set(['OFF','FINAL']);

const RULES = {
  skater:{firstStars:3,assists:2.5,blocks:.5,faceoffsLost:-.2,faceoffsWon:.2,fights:3,gameWinningGoals:2,goals:3.5,gordieHoweHatTricks:3,hatTricks:3,hits:.25,minorPenalties:2,powerPlayPoints:1,shootoutGoals:2,shortHandedPoints:2,shotsOnGoal:.25},
  goalie:{firstStars:3,assists:5,goals:50,goalsAgainst:-1,saves:.25,shutouts:3,wins:5}
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const local = value => value?.default || value?.en || value || '';

async function fetchJson(url, { retries = 4, timeout = 30000 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { headers: { Accept:'application/json', 'User-Agent':'FDA-Fantasy-Hockey/1.0' }, signal:controller.signal });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) throw new Error(`${response.status} ${response.statusText} for ${url}`);
        throw new Error(`Retryable ${response.status} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      last = error;
      if (attempt < retries) await sleep(Math.min(12000, 700 * 2 ** attempt + Math.random() * 500));
    } finally { clearTimeout(timer); }
  }
  throw last;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive:true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

async function pool(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      try { results[current] = { status:'fulfilled', value:await worker(items[current], current) }; }
      catch (reason) { results[current] = { status:'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length:Math.min(concurrency, items.length || 1) }, run));
  return results;
}

function statsReportUrl(type) {
  const params = new URLSearchParams({
    isAggregate:'false', isGame:'false', start:'0', limit:'-1',
    cayenneExp:`seasonId=${SEASON} and gameTypeId=2`,
    sort:JSON.stringify([{ property:'playerId', direction:'ASC' }])
  });
  return `${NHL_STATS}/${type}/summary?${params}`;
}

function latestTeamAbbrev(row) {
  const raw = String(row.teamAbbrevs || row.teamAbbrev || row.team || '');
  return raw.split(',').map(value=>value.trim()).filter(Boolean).at(-1) || '';
}

async function playerIdentityMap() {
  console.log('Fetching official NHL player identities…');
  const [skaterResult, goalieResult] = await Promise.allSettled([
    fetchJson(statsReportUrl('skater')),
    fetchJson(statsReportUrl('goalie'))
  ]);
  const identities = new Map();
  const addRows = (payload, playerType) => {
    for (const row of payload?.data || []) {
      const id = num(row.playerId); if (!id) continue;
      identities.set(id, {
        name:row.skaterFullName || row.goalieFullName || row.playerName || '',
        team:latestTeamAbbrev(row),
        position:playerType === 'goalie' ? 'G' : (row.positionCode || row.position || ''),
        playerType
      });
    }
  };
  if (skaterResult.status === 'fulfilled') addRows(skaterResult.value,'skater');
  else console.warn('Skater identity report failed:', skaterResult.reason?.message || skaterResult.reason);
  if (goalieResult.status === 'fulfilled') addRows(goalieResult.value,'goalie');
  else console.warn('Goalie identity report failed:', goalieResult.reason?.message || goalieResult.reason);
  console.log(`${identities.size} player identities loaded.`);
  return identities;
}

async function seasonGames() {
  console.log(`Fetching ${SEASON} club schedules…`);
  const results = await pool(TEAMS, async team => fetchJson(`${NHL_WEB}/club-schedule-season/${team}/${SEASON}`), 8);
  const games = new Map();
  const failures = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') { failures.push(`${TEAMS[index]}: ${result.reason.message}`); return; }
    for (const game of result.value.games || []) {
      const id = num(game.id || game.gameId);
      if (!id || num(game.gameType || game.gameTypeId) !== 2 || !FINAL_STATES.has(game.gameState)) continue;
      games.set(id, { id, gameDate:game.gameDate, gameState:game.gameState, homeTeam:game.homeTeam, awayTeam:game.awayTeam });
    }
  });
  if (failures.length) console.warn('Schedule failures:', failures.join(' | '));
  return [...games.values()].sort((a,b)=>a.id-b.id);
}

function blankStats() {
  return { goals:0,assists:0,shotsOnGoal:0,hits:0,blocks:0,faceoffsWon:0,faceoffsLost:0,powerPlayPoints:0,shortHandedPoints:0,gameWinningGoals:0,minorPenalties:0,fights:0,shootoutGoals:0,hatTricks:0,gordieHoweHatTricks:0,firstStars:0,saves:0,goalsAgainst:0,wins:0,shutouts:0 };
}

function addPlayer(players, id, patch = {}) {
  id = num(id); if (!id) return null;
  if (!players[id]) players[id] = { id, name:'', team:'NHL', position:'F', playerType:'skater', played:false, stats:blankStats() };
  const player = players[id];
  if (patch.name) player.name = patch.name;
  if (patch.team) player.team = patch.team;
  if (patch.position) player.position = patch.position;
  if (patch.playerType) player.playerType = patch.playerType;
  if (patch.played !== undefined) player.played = player.played || patch.played;
  return player;
}

function playerName(row) { return local(row.name) || local(row.playerName) || row.skaterFullName || row.goalieFullName || ''; }
function playerId(row) { return num(row.playerId || row.id); }
function rowPosition(row, fallback='F') { return row.position || row.positionCode || fallback; }
function rowToiSeconds(row) {
  const raw = row.toi || row.timeOnIce || '0:00';
  if (typeof raw === 'number') return raw;
  const [m,s] = String(raw).split(':').map(Number); return num(m)*60+num(s);
}

function extractBoxscorePlayers(boxscore) {
  const players = {};
  const container = boxscore.playerByGameStats || boxscore.playerByGameStatsByTeam || {};
  for (const side of ['awayTeam','homeTeam']) {
    const teamObject = boxscore[side] || {};
    const teamId = num(teamObject.id);
    const team = teamObject.abbrev || local(teamObject.placeName) || side;
    const groups = container[side] || container[side === 'homeTeam' ? 'home' : 'away'] || {};
    for (const group of ['forwards','defense','defencemen','skaters']) {
      for (const row of groups[group] || []) {
        const id = playerId(row); if (!id) continue;
        const p = addPlayer(players,id,{name:playerName(row),team,position:rowPosition(row,group.startsWith('def')?'D':'F'),playerType:'skater',played:rowToiSeconds(row)>0});
        p.teamId = teamId;
        p.stats.goals += num(row.goals);
        p.stats.assists += num(row.assists);
        p.stats.shotsOnGoal += num(row.sog ?? row.shots ?? row.shotsOnGoal);
        p.stats.hits += num(row.hits);
        p.stats.blocks += num(row.blockedShots ?? row.blocks);
      }
    }
    for (const row of groups.goalies || []) {
      const id = playerId(row); if (!id) continue;
      const p = addPlayer(players,id,{name:playerName(row),team,position:'G',playerType:'goalie',played:rowToiSeconds(row)>0});
      p.teamId = teamId;
      const shotsAgainst = num(row.shotsAgainst);
      const goalsAgainst = num(row.goalsAgainst);
      p.stats.saves += num(row.saves ?? (shotsAgainst-goalsAgainst));
      p.stats.goalsAgainst += goalsAgainst;
      p.stats.goals += num(row.goals);
      p.stats.assists += num(row.assists);
      if (String(row.decision || '').toUpperCase() === 'W') p.stats.wins += 1;
      p._goalieDecision = row.decision || '';
      p._goalieToi = rowToiSeconds(row);
    }
  }
  return players;
}

function eventType(play) { return String(play.typeDescKey || play.type || play.eventType || '').toLowerCase(); }
function periodType(play) { return String(play.periodDescriptor?.periodType || play.periodType || '').toUpperCase(); }
function offenderId(details) { return num(details.committedByPlayerId || details.penalizedPlayerId || details.servedByPlayerId || details.playerId); }

function manpower(play, scoringTeamId, homeTeamId, awayTeamId) {
  const code = String(play.situationCode || play.details?.situationCode || '');
  if (!/^\d{4}$/.test(code)) return 'EV';
  const digits = code.split('').map(Number);
  const awaySkaters = digits[1], homeSkaters = digits[2];
  const scoringSkaters = scoringTeamId === homeTeamId ? homeSkaters : scoringTeamId === awayTeamId ? awaySkaters : 0;
  const opponentSkaters = scoringTeamId === homeTeamId ? awaySkaters : scoringTeamId === awayTeamId ? homeSkaters : 0;
  if (!scoringSkaters || !opponentSkaters) return 'EV';
  if (scoringSkaters > opponentSkaters) return 'PP';
  if (scoringSkaters < opponentSkaters) return 'SH';
  return 'EV';
}

function recursiveThreeStars(value, key='') {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value) && key.toLowerCase().includes('threestar')) return value;
  for (const [childKey, child] of Object.entries(value)) {
    if (Array.isArray(child) && childKey.toLowerCase().includes('threestar')) return child;
    const found = recursiveThreeStars(child, childKey); if (found) return found;
  }
  return null;
}

function starPlayerId(star) { return num(star?.playerId || star?.id || star?.player?.playerId || star?.player?.id); }

function summarize(stats, type) {
  if (type === 'goalie') return `${stats.saves} SV · ${stats.goalsAgainst} GA${stats.wins?' · W':''}${stats.shutouts?' · SHO':''}`;
  const parts=[]; if(stats.goals)parts.push(`${stats.goals} G`); if(stats.assists)parts.push(`${stats.assists} A`); if(stats.shotsOnGoal)parts.push(`${stats.shotsOnGoal} SOG`); if(stats.hits)parts.push(`${stats.hits} Hit`); if(stats.blocks)parts.push(`${stats.blocks} Blk`); if(stats.firstStars)parts.push('1Star'); return parts.join(' · ') || 'Game played';
}

function scoreStats(stats, type) { return Object.entries(RULES[type]).reduce((sum,[key,value])=>sum+num(stats[key])*value,0); }

async function processGame(game) {
  const [boxscore,playByPlay,landing] = await Promise.all([
    fetchJson(`${NHL_WEB}/gamecenter/${game.id}/boxscore`),
    fetchJson(`${NHL_WEB}/gamecenter/${game.id}/play-by-play`),
    fetchJson(`${NHL_WEB}/gamecenter/${game.id}/landing`).catch(()=>null)
  ]);
  const players = extractBoxscorePlayers(boxscore);
  const homeTeamId = num(boxscore.homeTeam?.id), awayTeamId = num(boxscore.awayTeam?.id);
  const homeAbbrev = boxscore.homeTeam?.abbrev || game.homeTeam?.abbrev || 'HOME';
  const awayAbbrev = boxscore.awayTeam?.abbrev || game.awayTeam?.abbrev || 'AWAY';
  const fightByPlayer = new Map();
  const goalEvents = [];

  for (const play of playByPlay.plays || []) {
    const type = eventType(play); const details = play.details || {};
    if (type.includes('faceoff')) {
      const winner = addPlayer(players,details.winningPlayerId); if (winner) winner.stats.faceoffsWon++;
      const loser = addPlayer(players,details.losingPlayerId); if (loser) loser.stats.faceoffsLost++;
      continue;
    }
    if (type.includes('penalty')) {
      const id = offenderId(details); const p = addPlayer(players,id); if (!p) continue;
      const desc = `${details.descKey || ''} ${details.typeCode || ''} ${details.penaltyType || ''}`.toLowerCase();
      const duration = num(details.duration || details.durationInMinutes || play.duration);
      if (desc.includes('fight')) { p.stats.fights++; fightByPlayer.set(id,(fightByPlayer.get(id)||0)+1); }
      const explicitlyMinor = desc.includes('minor') && !desc.includes('misconduct');
      if (explicitlyMinor || ([2,4].includes(duration) && !desc.includes('major') && !desc.includes('misconduct') && !desc.includes('match'))) p.stats.minorPenalties += duration === 4 ? 2 : 1;
      continue;
    }
    if (type === 'goal' || type.endsWith('-goal') || type.includes('goal')) {
      const scorerId = num(details.scoringPlayerId || details.playerId);
      if (!scorerId) continue;
      const scorer = addPlayer(players,scorerId);
      const scoringTeamId = num(details.eventOwnerTeamId || play.eventOwnerTeamId);
      if (periodType(play) === 'SO') { if (scorer) scorer.stats.shootoutGoals++; continue; }
      const assistIds = [details.assist1PlayerId,details.assist2PlayerId].map(num).filter(Boolean);
      const ids = [scorerId,...assistIds].filter(Boolean);
      if (scorer?.playerType === 'goalie') scorer.stats.goals++;
      assistIds.forEach(id=>{ const assister=players[id]; if(assister?.playerType==='goalie') assister.stats.assists++; });
      const strength = manpower(play,scoringTeamId,homeTeamId,awayTeamId);
      if (strength === 'PP') ids.forEach(id=>{ const p=addPlayer(players,id); if(p)p.stats.powerPlayPoints++; });
      if (strength === 'SH') ids.forEach(id=>{ const p=addPlayer(players,id); if(p)p.stats.shortHandedPoints++; });
      goalEvents.push({ scorerId, teamId:scoringTeamId });
    }
  }

  const nonShootoutHomeGoals = goalEvents.filter(g=>g.teamId===homeTeamId).length;
  const nonShootoutAwayGoals = goalEvents.filter(g=>g.teamId===awayTeamId).length;
  if (nonShootoutHomeGoals !== nonShootoutAwayGoals) {
    const winnerTeamId = nonShootoutHomeGoals > nonShootoutAwayGoals ? homeTeamId : awayTeamId;
    const loserGoals = Math.min(nonShootoutHomeGoals,nonShootoutAwayGoals);
    const winningGoals = goalEvents.filter(g=>g.teamId===winnerTeamId);
    const gwg = winningGoals[loserGoals];
    if (gwg) { const p=addPlayer(players,gwg.scorerId); if(p)p.stats.gameWinningGoals++; }
  }

  for (const player of Object.values(players)) {
    if (player.playerType === 'skater' && player.stats.goals >= 3) player.stats.hatTricks++;
    if (player.playerType === 'skater' && player.stats.goals && player.stats.assists && (fightByPlayer.get(player.id)||0)) player.stats.gordieHoweHatTricks++;
  }

  const stars = recursiveThreeStars(landing);
  if (stars?.length) {
    const first = stars.find(star=>num(star.star || star.starNumber || star.rank)===1) || stars[0];
    const id = starPlayerId(first); const p=addPlayer(players,id); if (p) p.stats.firstStars++;
  }

  const homeScore=num(boxscore.homeTeam?.score), awayScore=num(boxscore.awayTeam?.score);
  const winnerTeamId=homeScore>awayScore?homeTeamId:awayTeamId;
  for(const player of Object.values(players)){
    if(player.playerType!=='goalie'||!player.played)continue;
    const sameTeamGoalies=Object.values(players).filter(p=>p.playerType==='goalie'&&p.teamId===player.teamId&&p.played);
    if(player.teamId===winnerTeamId&&player.stats.goalsAgainst===0&&player.stats.wins>0&&sameTeamGoalies.length===1)player.stats.shutouts++;
  }

  for (const player of Object.values(players)) {
    if (!player.played && !Object.values(player.stats).some(Boolean)) continue;
    const ownTeamId=player.teamId; const opponent=ownTeamId===homeTeamId?awayAbbrev:homeAbbrev;
    const ownScore=ownTeamId===homeTeamId?homeScore:awayScore; const oppScore=ownTeamId===homeTeamId?awayScore:homeScore;
    player.opponent=opponent; player.result=`${ownScore>oppScore?'W':ownScore<oppScore?'L':'T'} ${ownScore}–${oppScore}`;
    player.summary=summarize(player.stats,player.playerType);
    player.fantasyPoints=Number(scoreStats(player.stats,player.playerType).toFixed(2));
    player.stats=Object.fromEntries(Object.entries(player.stats).filter(([,value])=>num(value)!==0));
    delete player._goalieDecision; delete player._goalieToi; delete player.teamId;
  }

  return { gameId:game.id, date:game.gameDate || boxscore.gameDate, homeTeam:homeAbbrev, awayTeam:awayAbbrev, homeScore, awayScore, players };
}

function aggregate(cache, identities = new Map()) {
  const byPlayer = new Map();
  const games = Object.values(cache).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  for(const game of games){
    for(const raw of Object.values(game.players||{})){
      if(!raw?.id)continue;
      if(!byPlayer.has(raw.id))byPlayer.set(raw.id,{id:raw.id,name:raw.name||`Player ${raw.id}`,team:raw.team||'NHL',position:raw.position||'F',playerType:raw.playerType||'skater',gamesPlayed:0,stats:blankStats(),games:[],_lastDate:''});
      const player=byPlayer.get(raw.id);
      if(game.date>=player._lastDate){player.name=raw.name||player.name;player.team=raw.team||player.team;player.position=raw.position||player.position;player.playerType=raw.playerType||player.playerType;player._lastDate=game.date;}
      if(raw.played)player.gamesPlayed++;
      for(const [key,value] of Object.entries(raw.stats||{}))player.stats[key]=num(player.stats[key])+num(value);
      player.games.push({gameId:game.gameId,date:game.date,opponent:raw.opponent,result:raw.result,summary:raw.summary,stats:raw.stats,fantasyPoints:raw.fantasyPoints});
    }
  }
  const players=[...byPlayer.values()].map(player=>{
    delete player._lastDate;
    const identity=identities.get(num(player.id));
    if(identity?.name)player.name=identity.name;
    if(identity?.team)player.team=identity.team;
    if(identity?.position)player.position=identity.position;
    if(identity?.playerType)player.playerType=identity.playerType;
    const fantasyPoints=Number(scoreStats(player.stats,player.playerType).toFixed(2));
    const fpg=player.gamesPlayed?Number((fantasyPoints/player.gamesPlayed).toFixed(4)):0;
    player.fantasyPoints=fantasyPoints;player.fpg=fpg;player.dataQuality='exact';
    player.games=player.games.slice(-15);
    return player;
  }).filter(player=>player.gamesPlayed>0).sort((a,b)=>b.fpg-a.fpg||b.fantasyPoints-a.fantasyPoints);
  return players;
}

async function main(){
  await fs.mkdir(DATA_DIR,{recursive:true});
  const cacheFile=path.join(DATA_DIR,'game-contributions.json');
  const playersFile=path.join(DATA_DIR,'players.json');
  const cache=await readJson(cacheFile,{});
  const [games,identities]=await Promise.all([seasonGames(),playerIdentityMap()]);
  if(games.length < 100) throw new Error(`Only ${games.length} completed games were returned. Refusing to overwrite the existing database with an incomplete schedule.`);
  const pending=games.filter(game=>!cache[game.id]);
  console.log(`${games.length} completed regular-season games found; ${pending.length} require processing.`);
  const results=await pool(pending,async(game,index)=>{
    const processed=await processGame(game);
    if((index+1)%25===0)console.log(`Processed ${index+1}/${pending.length} new games…`);
    return processed;
  });
  const failures=[];
  results.forEach((result,index)=>{if(result.status==='fulfilled')cache[result.value.gameId]=result.value;else failures.push({gameId:pending[index]?.id,error:result.reason?.message||String(result.reason)});});
  await writeJson(cacheFile,cache);
  const players=aggregate(cache,identities);
  const payload={season:SEASON,metadata:{generatedAt:new Date().toISOString(),source:'Official NHL Gamecenter boxscore, play-by-play and landing endpoints',gamesAvailable:games.length,gamesProcessed:Object.keys(cache).length,newGamesProcessed:pending.length-failures.length,failedGames:failures.length,scoringVersion:'FDA Fantrax rules 2026-07-26'},players};
  await writeJson(playersFile,payload);
  await writeJson(path.join(DATA_DIR,'last-sync.json'),{...payload.metadata,failures});
  console.log(`Wrote ${players.length} exact player records from ${Object.keys(cache).length} games.`);
  if(failures.length) console.warn(`${failures.length} games failed and will retry next run.`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
