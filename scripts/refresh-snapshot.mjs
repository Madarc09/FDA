import { writeFile } from "node:fs/promises";
import { context, getRoster, getPlayer } from "../server/nhl.mjs";
import { getLineup } from "../server/lineups.mjs";

// Run deliberately before a release. This never changes the permanent card art.
const [ctx, roster] = await Promise.all([context(), getRoster("TOR")]);
const lineup = await getLineup(roster.data, ctx.season);
if (lineup.data.mode !== "automatic" || lineup.meta.stale)
  throw new Error(
    "A fresh automatic projection is required; saved files were not changed.",
  );
const players = [];
for (let index = 0; index < roster.data.length; index += 4) {
  const batch = await Promise.all(
    roster.data.slice(index, index + 4).map((p) => getPlayer(p.id)),
  );
  if (batch.some((p) => p.meta.stale))
    throw new Error(
      "A live player profile was unavailable; saved files were not changed.",
    );
  players.push(...batch.map((p) => p.data));
}
const capturedAt = new Date().toISOString();
const { mode, ...projection } = lineup.data;
projection.fetchedAt = capturedAt;
await writeFile(
  new URL("../data/toronto-players.json", import.meta.url),
  JSON.stringify(
    {
      season: ctx.season,
      capturedAt,
      source: "NHL player landing API",
      players,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  new URL("../data/toronto-lineup.json", import.meta.url),
  JSON.stringify(projection, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      capturedAt,
      season: ctx.season,
      players: players.length,
      lineupSource: projection.sourceName,
      sourceUpdatedAt: projection.sourceUpdatedAt,
    },
    null,
    2,
  ),
);
