import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { sortRows, filterRows, columns } from "../shared/stat-columns.mjs";
import { ageOn, number, format, easternDate } from "../shared/format.mjs";
import {
  normalizeStats,
  normalizeGame,
  normalizeGameDetail,
} from "../shared/normalize.mjs";
import {
  parseDailyFaceoff,
  validateLineup,
  robotsAllows,
} from "../server/lineups.mjs";
import { cached, resetCaches } from "../server/http.mjs";
import { route } from "../server/router.mjs";
const fixture = JSON.parse(
  await fs.readFile(new URL("./fixtures.json", import.meta.url)),
);
const profiles = JSON.parse(
  await fs.readFile(new URL("../data/toronto-players.json", import.meta.url)),
);
const collection = JSON.parse(
  await fs.readFile(new URL("../data/collection.json", import.meta.url)),
);
const lineup = JSON.parse(
  await fs.readFile(new URL("../data/toronto-lineup.json", import.meta.url)),
);
test("numeric sorting keeps nulls last in both directions and does not mutate source", () => {
  const rows = [
    { id: 1, name: "A", v: 9 },
    { id: 2, name: "B", v: null },
    { id: 3, name: "C", v: 10 },
    { id: 4, name: "D", v: 0 },
  ];
  assert.deepEqual(
    sortRows(rows, "v", "desc").map((r) => r.id),
    [3, 1, 4, 2],
  );
  assert.deepEqual(
    sortRows(rows, "v", "asc").map((r) => r.id),
    [4, 1, 3, 2],
  );
  assert.equal(rows[0].id, 1);
});
test("all configured numerical columns sort coherently, including GAA and save percentage", () => {
  for (const list of Object.values(columns))
    for (const c of list.filter((c) => c.kind !== "text")) {
      const sample = [
        { id: 1, name: "One", [c.key]: 1 },
        { id: 2, name: "Two", [c.key]: 9 },
        { id: 3, name: "Missing", [c.key]: null },
      ];
      const sorted = sortRows(sample, c.key, c.lower ? "asc" : "desc");
      assert.equal(sorted[0].id, c.lower ? 1 : 2);
      assert.equal(sorted[2].id, 3);
    }
});
test("search is accent insensitive; team, position and minimum GP combine", () => {
  const rows = [
    {
      name: "Cédric Test",
      teams: ["TOR", "MTL"],
      position: "C",
      gamesPlayed: 8,
    },
    { name: "Cedric Two", teams: ["TOR"], position: "D", gamesPlayed: 1 },
  ];
  assert.equal(
    filterRows(rows, {
      query: "cedric",
      team: "MTL",
      position: "C",
      minGames: 5,
    }).length,
    1,
  );
  assert.equal(filterRows(rows, { minGames: 20 }).length, 0);
});
test("missing values remain unavailable; percentages and goalie minutes use correct units", () => {
  assert.equal(number(null), null);
  assert.equal(number(undefined), null);
  assert.equal(format(null), "—");
  assert.equal(format(0.92173, "save"), ".922");
  assert.equal(format(39591, "minutes"), "659.9");
  assert.equal(format(987.1176, "time"), "16:27");
});
test("birthday and Toronto calendar boundaries are correct", () => {
  assert.equal(ageOn("1997-09-17", new Date("2026-09-16T12:00:00Z")), 28);
  assert.equal(ageOn("1997-09-17", new Date("2026-09-17T12:00:00Z")), 29);
  assert.equal(easternDate(new Date("2026-11-08T02:00:00Z")), "2026-11-07");
});
test("team power-play goals use the verified report field", () => {
  const [row] = normalizeStats(
    "team",
    [{ teamId: 1, teamFullName: "Test", goalsFor: 10, goalsAgainst: 7 }],
    [],
    [],
    [{ teamId: 1, powerPlayGoalsFor: 4 }],
  );
  assert.equal(row.powerPlayGoals, 4);
  assert.equal(row.goalDifferential, 3);
  assert.equal(row.shots, null);
});
test("public DFO page maps all 20 unique players to NHL identities, including special teams", () => {
  const html = `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { combinations: fixture.dfo } } })}</script>`;
  const parsed = parseDailyFaceoff(html, profiles.players);
  assert.equal(parsed.status, "projected");
  assert.equal(parsed.groups.f1[1].id, 8479318);
  assert.equal(parsed.groups.pp1.length, 5);
  assert.equal(parsed.groups.pk1.length, 4);
  assert.equal(parsed.groups.g.length, 2);
});
test("lineup validation rejects missing slots, wrong identities and duplicate players", () => {
  const base = structuredClone(lineup);
  assert.doesNotThrow(() => validateLineup(base, profiles.players));
  base.groups.f1[0].id = 1;
  assert.throws(() => validateLineup(base, profiles.players));
  const duplicate = structuredClone(lineup);
  duplicate.groups.f1[0] = duplicate.groups.f1[1];
  assert.throws(() => validateLineup(duplicate, profiles.players));
});
test("robots policy allows public page and refuses restricted API", () => {
  const robots = "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /cms/";
  assert.equal(
    robotsAllows(robots, "/teams/toronto-maple-leafs/line-combinations"),
    true,
  );
  assert.equal(robotsAllows(robots, "/api/private"), false);
  assert.equal(
    robotsAllows("User-agent: *\nDisallow: /", "/teams/toronto"),
    false,
  );
  assert.equal(robotsAllows("", "/teams"), false);
});
test("game goals and penalties are chronological with correct explicit PP markers", () => {
  const g = normalizeGameDetail(
    fixture.game_landing,
    fixture.game_boxscore,
    fixture["game_right-rail"],
  );
  assert.ok(g.goals.length > 1);
  assert.ok(g.goals.some((g) => g.strength === "pp"));
  assert.ok(g.penalties.length);
  assert.ok(g.comparisons.some((s) => s.category === "powerPlay"));
  for (let i = 1; i < g.goals.length; i++) {
    const a = g.goals[i - 1],
      b = g.goals[i];
    assert.ok(
      a.period < b.period || (a.period === b.period && a.time <= b.time),
    );
  }
});
test("no fabricated current power play or pregame confirmed starter", () => {
  const live = normalizeGameDetail(
    fixture.game_landing,
    fixture.game_boxscore,
    fixture["game_right-rail"],
  );
  assert.equal(live.situationKnown, false);
  assert.deepEqual(live.away.situations, []);
  const pre = normalizeGameDetail(
    fixture.pregame_landing,
    fixture.pregame_boxscore,
    {},
  );
  for (const group of Object.values(pre.goalies))
    for (const p of group) assert.equal(p.starter, false);
  const explicit = normalizeGame({
    ...fixture.game_landing,
    situation: {
      awayTeam: { strength: 5, situationDescriptions: ["PP"] },
      homeTeam: { strength: 4, situationDescriptions: [] },
      timeRemaining: "00:24",
    },
  });
  assert.equal(explicit.away.situations[0], "PP");
  assert.equal(explicit.situationClock, "00:24");
});
test("explicit final starter flags are retained", () => {
  const b = fixture.final_boxscore,
    g = normalizeGameDetail(
      { ...fixture.game_landing, awayTeam: b.awayTeam, homeTeam: b.homeTeam },
      b,
      {},
    );
  assert.ok(
    Object.values(g.goalies)
      .flat()
      .some((p) => p.starter),
  );
});
test("permanent Toronto card assets and identities are complete and distinct", async () => {
  assert.equal(collection.cards.length, 20);
  assert.equal(new Set(collection.cards.map((c) => c.id)).size, 20);
  assert.equal(collection.cards.filter((c) => c.distinctPhotos).length, 12);
  for (const card of collection.cards) {
    assert.ok(
      profiles.players.some(
        (p) => p.id === card.playerId && p.name === card.displayName,
      ),
    );
    assert.equal(card.issuedForTeam, "TOR");
    for (const asset of [card.frontAsset, card.backAsset])
      assert.ok(
        (await fs.stat(new URL(`../public${asset}`, import.meta.url))).size >
          1000,
      );
    assert.equal(card.frontAsset !== card.backAsset, card.distinctPhotos);
  }
});
test("cache deduplicates concurrent requests and visibly labels stale fallbacks", async () => {
  resetCaches();
  let calls = 0;
  const task = () => {
    calls++;
    return Promise.resolve({ data: 1, meta: { fetchedAt: "2026-01-01" } });
  };
  await Promise.all([cached("x", 1000, task), cached("x", 1000, task)]);
  assert.equal(calls, 1);
  const stale = await cached(
    "x",
    -1,
    () => {
      throw new Error("offline");
    },
    { allowStale: true },
  );
  assert.equal(stale.meta.stale, true);
  assert.equal(stale.meta.fetchedAt, "2026-01-01");
});
test("API input validation prevents arbitrary upstream requests", async () => {
  for (const query of [
    "resource=unknown",
    "resource=game&id=http://example.com",
    "resource=player&id=1",
    "resource=stats&kind=secret",
    "resource=scores&date=2026-02-31",
  ])
    await assert.rejects(() => route(new URLSearchParams(query)));
});
test("an upstream outage still returns a dated Toronto lineup and biography", async () => {
  resetCaches();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Simulated upstream outage");
  };
  try {
    const result = await route(new URLSearchParams("resource=lineup"));
    assert.equal(result.data.mode, "saved");
    assert.equal(result.meta.stale, true);
    assert.equal(result.data.groups.f1[1].id, 8479318);
    assert.match(result.meta.warning, /saved roster/);
    const player = await route(
      new URLSearchParams("resource=player&id=8479318"),
    );
    assert.equal(player.data.name, "Auston Matthews");
    assert.equal(player.meta.stale, true);
    assert.equal(player.meta.fetchedAt, profiles.capturedAt);
  } finally {
    globalThis.fetch = originalFetch;
    resetCaches();
  }
});
test("a failed cache refresh can be retried successfully", async () => {
  resetCaches();
  await cached("retry", 1000, () => Promise.resolve({ data: 1 }));
  await cached(
    "retry",
    -1,
    () => {
      throw new Error("offline");
    },
    { allowStale: true },
  );
  const fresh = await cached("retry", -1, () => Promise.resolve({ data: 2 }));
  assert.equal(fresh.data, 2);
});
