import assert from "node:assert/strict";
import { route } from "../server/router.mjs";
const call = (params) => route(new URLSearchParams(params));
const result = { checkedAt: new Date().toISOString(), checks: [] };
const c = await call({ resource: "context" });
assert.equal(c.data.teams.length, 32);
for (const kind of ["team", "skater", "goalie"]) {
  const r = await call({ resource: "stats", kind });
  assert.ok(r.data.rows.length);
  assert.equal(new Set(r.data.rows.map((r) => r.id)).size, r.data.rows.length);
  if (kind === "team") {
    assert.equal(r.data.rows.length, 32);
    assert.ok(r.data.rows.some((r) => r.powerPlayGoals != null));
  }
  result.checks.push({
    resource: kind,
    count: r.data.rows.length,
    season: r.meta.season,
    partial: r.meta.partial,
  });
}
const p = await call({ resource: "player", id: "8479318" });
assert.equal(p.data.id, 8479318);
assert.ok(p.data.history.length);
result.checks.push({
  resource: "player",
  name: p.data.name,
  historyRows: p.data.history.length,
  stale: p.meta.stale,
});
const l = await call({ resource: "lineup" });
assert.ok(l.data.groups.f1?.length === 3);
result.checks.push({
  resource: "lineup",
  source: l.meta.source,
  mode: l.data.mode,
  updatedAt: l.data.sourceUpdatedAt,
  stale: l.meta.stale,
});
const s = await call({ resource: "scores", date: "now" });
assert.ok(Array.isArray(s.data.games));
result.checks.push({
  resource: "scores",
  count: s.data.games.length,
  date: s.data.date,
});
const id =
  s.data.games.find((g) => ["LIVE", "CRIT", "FINAL", "OFF"].includes(g.state))
    ?.id || s.data.games[0]?.id;
if (id) {
  const g = await call({ resource: "game", id: String(id) });
  assert.equal(g.data.id, id);
  assert.ok(g.data.away.abbrev);
  result.checks.push({
    resource: "game",
    id,
    state: g.data.state,
    goals: g.data.goals.length,
    penalties: g.data.penalties.length,
    comparisons: g.data.comparisons.length,
    partial: g.meta.partial,
  });
}
console.log(JSON.stringify(result, null, 2));
