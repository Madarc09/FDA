import { readFile } from "node:fs/promises";
import {
  context,
  getStats,
  getRoster,
  getPlayer,
  getScores,
  getGame,
} from "./nhl.mjs";
import { getLineup } from "./lineups.mjs";
import { envelope } from "./http.mjs";
let snapshots;
async function savedPlayers() {
  snapshots ??= JSON.parse(
    await readFile(
      new URL("../data/toronto-players.json", import.meta.url),
      "utf8",
    ),
  );
  return snapshots;
}
export async function route(params) {
  const resource = params.get("resource");
  if (resource === "context") {
    const c = await context();
    return envelope(
      { season: c.season, sourceDate: c.sourceDate, teams: c.teams },
      "NHL standings API",
    );
  }
  if (resource === "stats") {
    const kind = params.get("kind");
    if (!["team", "skater", "goalie"].includes(kind))
      throw Object.assign(new Error("Invalid statistics category"), {
        status: 400,
      });
    const season = params.get("season");
    if (season && !/^20\d{2}20\d{2}$/.test(season))
      throw Object.assign(new Error("Invalid season"), { status: 400 });
    return getStats(kind, season ? Number(season) : null);
  }
  if (resource === "roster") {
    try {
      return await getRoster("TOR");
    } catch (e) {
      const s = await savedPlayers();
      return envelope(s.players, "Saved NHL Toronto roster", {
        stale: true,
        fetchedAt: s.capturedAt,
        warning:
          "The live roster is unavailable. Showing the saved roster from the displayed date.",
      });
    }
  }
  if (resource === "lineup") {
    const [rosterResult, contextResult] = await Promise.allSettled([
      getRoster("TOR"),
      context(),
    ]);
    const saved =
      rosterResult.status === "rejected" || contextResult.status === "rejected"
        ? await savedPlayers()
        : null;
    const roster =
      rosterResult.status === "fulfilled"
        ? rosterResult.value.data
        : saved.players;
    const season =
      contextResult.status === "fulfilled"
        ? contextResult.value.season
        : saved.season;
    const result = await getLineup(roster, season);
    if (rosterResult.status === "rejected")
      return {
        ...result,
        data: { ...result.data, mode: "saved" },
        meta: {
          ...result.meta,
          stale: true,
          warning: `Live roster validation is unavailable. This projection is matched to the saved roster from ${saved.capturedAt.slice(0, 10)}. ${result.meta.warning || ""}`,
        },
      };
    return result;
  }
  if (resource === "player") {
    const id = params.get("id");
    if (!/^\d{7}$/.test(id || ""))
      throw Object.assign(new Error("Invalid NHL player ID"), { status: 400 });
    try {
      return await getPlayer(id);
    } catch (e) {
      const s = await savedPlayers(),
        p = s.players.find((p) => p.id === Number(id));
      if (!p) throw e;
      return envelope(p, "Saved NHL player profile", {
        stale: true,
        fetchedAt: s.capturedAt,
        warning:
          "Live profile unavailable. This is the dated saved player biography and history.",
      });
    }
  }
  if (resource === "scores") {
    const date = params.get("date") || "now";
    if (
      date !== "now" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw Object.assign(new Error("Invalid game date"), { status: 400 });
    return getScores(date);
  }
  if (resource === "game") {
    const id = params.get("id");
    if (!/^20\d{8}$/.test(id || ""))
      throw Object.assign(new Error("Invalid NHL game ID"), { status: 400 });
    return getGame(id);
  }
  throw Object.assign(new Error("Unknown hockey resource"), { status: 404 });
}
export async function handleRequest(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  const url = new URL(req.url, "http://localhost");
  try {
    const result = await route(url.searchParams),
      resource = url.searchParams.get("resource");
    const ttl = ["scores", "game"].includes(resource)
      ? 15
      : resource === "lineup"
        ? 300
        : resource === "player"
          ? 3600
          : 120;
    res.setHeader(
      "Cache-Control",
      result.meta?.stale ? "no-store" : `public, max-age=0, s-maxage=${ttl}`,
    );
    res.statusCode = 200;
    res.end(req.method === "HEAD" ? "" : JSON.stringify(result));
  } catch (e) {
    res.statusCode = e.status || 502;
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          e.status && e.status < 500
            ? e.message
            : "The hockey data source is temporarily unavailable. Please try again.",
        detail:
          process.env.NODE_ENV === "development"
            ? `${e.message} ${e.cause?.code || ""} ${e.cause?.message || ""}`
            : undefined,
      }),
    );
  }
}
