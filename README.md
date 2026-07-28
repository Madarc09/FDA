# FDA - Fantrax Draft Assist

FDA is a mobile-first NHL fantasy draft assistant built around official NHL data and the league's custom Fantrax scoring system.

## Version 5 additions

The new **Historical** page builds the first layer of the player-comparable engine from official NHL historical reports. It includes:

- all-time career points, goals, assists and games-played leaders;
- the highest-scoring, highest-goal and highest-assist single seasons;
- career goalie wins and shutouts plus the winningest goalie seasons;
- career and single-season scoring leaders among defencemen;
- official NHL player headshots beside historical names;
- selectable career profiles with season-by-season regular-season totals;
- explicit data-coverage notes so unavailable old-era statistics are never treated as zero.

Historical data loads through the same-origin Vercel route at `/api/historical`. The page does not ship with a hand-picked list of legends or copied rankings; it requests and sorts official NHL records.

## Calendar Fit

The **Calendar Fit** page imports every NHL team's official schedule and calculates:

- all 496 two-team schedule combinations;
- the best and worst pairs for avoiding same-night conflicts;
- sparse-night opportunities, with an adjustable league-game threshold;
- final-four-week fantasy-playoff compatibility;
- all 4,960 three-team schedule cores;
- superstar pairings by joining schedule fit to FDA fantasy points per game;
- team schedule profiles, back-to-backs and busy-night exposure;
- roster-aware recommendations using nightly limits of 6 forwards, 4 defence and 2 goalies;
- a standard Monday-to-Sunday calendar for inspecting a selected pair.

The page never ranks a partial schedule. It requires at least 1,200 unique official regular-season games and substantially complete schedules for at least 30 teams before displaying results.

## Data sources

- Official NHL current rosters and season reports
- Official NHL historical career and single-season reports
- Official NHL Gamecenter game data
- Official NHL club schedule-season endpoints
- Official NHL EDGE tracking data on demand
- NHL player headshots and team marks

Fantasy points are calculated from raw categories using the saved league scoring rules. Fantrax fantasy totals are not copied into the database.

## Deploy to Vercel

1. Upload the contents of this folder to the root of the `FDA` GitHub repository.
2. Import the repository into Vercel. No build command is required.
3. In GitHub, open **Actions -> Sync NHL fantasy data -> Run workflow**.
4. The workflow creates the exact fantasy database and the cached schedule database, commits them to the repository, and triggers a Vercel redeploy.

The Historical page is on-demand and does not require an additional GitHub Action. Vercel caches its official NHL response for six hours.

## Commands

```bash
npm run sync:nhl
npm run validate:fantasy
npm run sync:calendar
```

Environment variables:

- `NHL_SEASON` - stats/Gamecenter season, default `20252026`
- `NHL_SCHEDULE_SEASON` - schedule season, default `20262027`
- `NHL_SYNC_CONCURRENCY` - Gamecenter synchronization concurrency
