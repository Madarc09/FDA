# FDA — Fantrax Draft Assist V3

A mobile-first fantasy-hockey research and draft application built around the user's Fantrax scoring rules.

## What changed in V3

V3 removes the three-player preview substitution. The player board now requires a complete NHL directory and refuses to label a tiny fallback list as the player pool.

### Complete player directory

`api/players.js` runs server-side on Vercel and combines:

1. all 32 official NHL current-roster endpoints;
2. official NHL skater season reports;
3. official NHL goalie season reports;
4. official NHL headshots and team assets.

The union includes current roster players with zero games and every player returned by the selected season reports. Records are deduplicated by NHL player ID.

### Fantasy FP/G

The database stores raw categories. The browser applies the editable Fantrax values in `app.js` and calculates FPTS and FP/G itself.

The server directory supplies the season-report categories immediately. The scheduled Gamecenter sync in `scripts/sync-nhl.mjs` adds the event-only categories required for exact Fantrax matching:

- First Stars
- exact minor penalties
- fights
- shootout goals
- hat tricks
- Gordie Howe hat tricks
- game-by-game fantasy totals

When `data/players.json` passes the validation suite, the interface labels those totals **Exact game sync**. It does not call a provisional total exact.

### NHL EDGE

The Player Laboratory contains an NHL EDGE tab. `api/edge.js` loads advanced tracking only for the selected player:

- skating speed;
- skating distance;
- shot speed;
- shot location;
- zone time;
- goalie tracking where available.

This on-demand approach avoids making six EDGE requests for every player when the page opens.

## Deployment

Upload the contents of this folder to the root of the `FDA` GitHub repository and import it into Vercel. No environment variables are required for the NHL player directory.

Vercel serves the static application and these same-origin functions:

```text
/api/players?season=20252026
/api/edge?playerId=8478402&season=20252026&position=C
```

The first GitHub Action run builds the exact game-event database. Open **Actions → Sync NHL fantasy data → Run workflow** to start it immediately instead of waiting for the daily schedule.

## Data behavior

- The page never substitutes Crosby, Malkin, Cowan, or any other hand-picked samples for the real player directory.
- If fewer than 300 official player records are returned, the request fails visibly instead of pretending the pool is complete.
- Current-roster players with no games remain searchable with `0 GP`.
- NHL player ID is the identity key, preventing duplicate players.
- API responses are cached to reduce requests.

## Main files

```text
index.html                    Interface
styles.css                   Responsive styling
app.js                       Player list, scoring, lab and draft behavior
api/players.js               Complete NHL roster + season-stat directory
api/edge.js                  On-demand NHL EDGE player data
scripts/sync-nhl.mjs         Exact game-event fantasy database
scripts/validate-fantasy.mjs Fantrax verification suite
.github/workflows/sync-nhl.yml Daily automated update
```

The official NHL endpoints are public-facing services rather than a guaranteed developer API. The application caches responses, identifies its requests, and surfaces source failures instead of silently inventing data.
