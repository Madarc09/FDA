import { cached, fetchSource, envelope } from "./http.mjs";
import {
  normalizePlayer,
  normalizeRoster,
  normalizeStats,
  normalizeGame,
  normalizeGameDetail,
} from "../shared/normalize.mjs";
import { text } from "../shared/format.mjs";
const WEB = "https://api-web.nhle.com/v1",
  STATS = "https://api.nhle.com/stats/rest/en";
export const web = (path, ttl = 60000) =>
  cached(`web:${path}`, ttl, () => fetchSource(`${WEB}/${path}`));
export async function context() {
  return cached("context", 300000, async () => {
    const s = await web("standings/now", 300000);
    if (!s.standings?.length) throw new Error("NHL standings unavailable");
    const season = process.env.NHL_SEASON || s.standings[0].seasonId;
    if (!/^\d{8}$/.test(String(season))) throw new Error("Invalid NHL season");
    return {
      season: Number(season),
      sourceDate: s.standings[0].date,
      standings: s.standings,
      teams: s.standings
        .map((t) => ({
          abbrev: text(t.teamAbbrev),
          name: text(t.teamName),
          logo: t.teamLogo,
          division: t.divisionName,
          conference: t.conferenceName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
}
export async function report(kind, name, season) {
  return cached(`stats:${kind}:${name}:${season}`, 300000, async () => {
    const key = kind === "team" ? "teamId" : "playerId";
    const params = new URLSearchParams({
      isAggregate: "false",
      isGame: "false",
      start: "0",
      limit: "-1",
      cayenneExp: `seasonId=${season} and gameTypeId=2`,
      sort: JSON.stringify([{ property: key, direction: "ASC" }]),
    });
    const get = () => fetchSource(`${STATS}/${kind}/${name}?${params}`);
    let response = await get();
    if (!Array.isArray(response.data) || !Number.isFinite(response.total))
      throw new Error("Unexpected NHL statistics format");
    const rows = [...response.data];
    while (rows.length < response.total) {
      if (rows.length > 10000)
        throw new Error("NHL statistics pagination limit");
      params.set("start", String(rows.length));
      params.set("limit", "100");
      response = await get();
      if (!response.data?.length) throw new Error("Incomplete NHL statistics");
      rows.push(...response.data);
    }
    if (new Set(rows.map((r) => r[key])).size !== rows.length)
      throw new Error("Duplicate identities in NHL report");
    return rows;
  });
}
export async function getStats(kind, requestedSeason) {
  const ctx = await context(),
    season = requestedSeason || ctx.season;
  return cached(
    `normalized:${kind}:${season}`,
    300000,
    async () => {
      const requests =
        kind === "team"
          ? [
              report(kind, "summary", season),
              report(kind, "realtime", season),
              report(kind, "powerplay", season),
            ]
          : kind === "skater"
            ? [
                report(kind, "summary", season),
                report(kind, "realtime", season),
              ]
            : [report(kind, "summary", season)];
      const r = await Promise.allSettled(requests);
      if (r[0].status === "rejected") throw r[0].reason;
      const missing = r.slice(1).filter((x) => x.status === "rejected").length;
      const data = normalizeStats(
        kind,
        r[0].value,
        r[1]?.value || [],
        ctx.standings,
        r[2]?.value || [],
      );
      return envelope({ rows: data, teams: ctx.teams }, "NHL statistics API", {
        season,
        sourceDate: ctx.sourceDate,
        partial: missing > 0,
        warning: missing
          ? "Some supplementary reports are unavailable. Missing statistics are shown as —."
          : null,
      });
    },
    { allowStale: true },
  );
}
export async function getRoster(team = "TOR") {
  return envelope(
    normalizeRoster(await web(`roster/${team}/current`, 600000), team),
    "NHL roster API",
  );
}
export async function getPlayer(id) {
  return cached(
    `player:${id}`,
    3600000,
    async () =>
      envelope(
        normalizePlayer(await web(`player/${id}/landing`, 3600000)),
        "NHL player API",
      ),
    { allowStale: true, maxStale: 86400000 },
  );
}
export async function getScores(date = "now") {
  return cached(`scores:${date}`, 20000, async () => {
    const raw = await web(`score/${date}`, 20000);
    if (!Array.isArray(raw.games))
      throw new Error("NHL scoreboard unavailable");
    return envelope(
      {
        games: raw.games.map(normalizeGame),
        date: raw.currentDate || date,
        prevDate: raw.prevDate,
        nextDate: raw.nextDate,
      },
      "NHL scoreboard API",
    );
  });
}
export async function getGame(id) {
  return cached(`game:${id}`, 20000, async () => {
    const r = await Promise.allSettled([
      web(`gamecenter/${id}/landing`, 20000),
      web(`gamecenter/${id}/boxscore`, 20000),
      web(`gamecenter/${id}/right-rail`, 20000),
    ]);
    if (r[0].status === "rejected") throw r[0].reason;
    const landing = r[0].value;
    let score = null;
    try {
      score = (await web(`score/${landing.gameDate}`, 20000)).games?.find(
        (g) => g.id === Number(id),
      );
    } catch {}
    const missing = r.slice(1).filter((x) => x.status === "rejected").length;
    return envelope(
      normalizeGameDetail(landing, r[1].value || {}, r[2].value || {}, score),
      "NHL gamecenter API",
      {
        partial: missing > 0,
        warning: missing
          ? "Some game detail feeds are temporarily unavailable."
          : null,
      },
    );
  });
}
