# FDA — Fantrax Draft Assist

A mobile-first fantasy hockey research and draft application built around **official NHL data** and Nick's exact Fantrax scoring rules.

## What is different in Version 2

This is no longer a hand-entered demo containing only the players used for scoring tests.

The application now has two automated data modes:

1. **Exact synced database** — the included GitHub Action processes every completed regular-season NHL game and writes a league-wide `data/players.json` file.
2. **Live API fallback** — before the first sync has completed, the browser loads league-wide official NHL season reports so the interface still contains the full player pool.

Official NHL player headshots and team logos appear beside player names using NHL player IDs and team abbreviations.

## Included application sections

- Dashboard with live data status and fantasy leaders
- League-wide player database
- Search, team filter, position filter and multiple sorts
- Player Laboratory
  - player image and team identity
  - calculated FPTS and FP/G
  - raw NHL statistics
  - category-by-category fantasy audit
  - recent game chart
  - exact game log after event sync
  - official upcoming team schedule
- Draft Room
  - 12 forwards, 8 defence and 3 goalies
  - locally saved roster
  - roster totals
  - best-player assistant by positional need
- Editable scoring page
- Data Centre with import diagnostics and source explanations

## Exact scoring rules

### Skaters

| Category | Value |
|---|---:|
| 1st Star | 3 |
| Assist | 2.5 |
| Block | 0.5 |
| Faceoff lost | -0.2 |
| Faceoff won | 0.2 |
| Fight | 3 |
| Game-winning goal | 2 |
| Goal | 3.5 |
| Gordie Howe hat trick | 3 |
| Hat trick | 3 |
| Hit | 0.25 |
| Minor penalty | 2 |
| Power-play point | 1 |
| Shootout goal | 2 |
| Short-handed point | 2 |
| Shot on goal | 0.25 |

### Goalies

| Category | Value |
|---|---:|
| 1st Star | 3 |
| Assist | 5 |
| Goal | 50 |
| Goal against | -1 |
| Save | 0.25 |
| Shutout | 3 |
| Win | 5 |

The database stores raw statistics. The website calculates fantasy totals dynamically, so changing a scoring value immediately recalculates every loaded player.

## Official NHL sources used

- `https://api.nhle.com/stats/rest` — live league-wide season report fallback
- `https://api-web.nhle.com/v1/club-schedule-season` — season schedules and game IDs
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore` — player game statistics
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play` — faceoffs, penalties, fights, shootouts and strength state
- `https://api-web.nhle.com/v1/gamecenter/{gameId}/landing` — ordered Three Stars
- `https://assets.nhle.com` — player headshots and team logos

The application does not copy Fantrax fantasy totals. It independently calculates them from raw hockey data.

## Deploy to the new FDA GitHub repository

Upload everything in this folder to the root of the repository. The repository root should contain:

```text
.github/
data/
scripts/
app.js
index.html
package.json
styles.css
vercel.json
```

Connect the repository to Vercel as a static site. No build command is required.

## Generate the exact full-season database

After the files are in GitHub:

1. Open the repository's **Actions** tab.
2. Open **Sync NHL fantasy data**.
3. Choose **Run workflow**.
4. Leave the season as `20252026` and run it.

The first run processes the completed regular season and may take several minutes. It commits these generated files back to the repository:

- `data/players.json`
- `data/game-contributions.json`
- `data/last-sync.json`
- `data/validation.json`

The workflow then compares the generated totals against the independently verified Fantrax results for Sidney Crosby (403.0), Evgeni Malkin (314.6), and Easton Cowan (184.1). The sync is labelled exact only when all three match. Later nightly runs process only games that are not already stored. Vercel then redeploys automatically after the data commit.

## Why the website will be fast

The page does not scrape hundreds of NHL games whenever somebody opens it. The GitHub Action does the slower collection work in the background. Visitors load one prepared JSON database and the browser performs the lightweight fantasy calculation, filtering and sorting.

## Data limitations and audit behaviour

The live browser fallback can load nearly all standard season statistics immediately, but event-only categories such as ordered First Stars and Gordie Howe hat tricks require the Gamecenter sync. The interface labels this fallback as provisional rather than silently claiming an exact total.

Once `data/players.json` is generated, every fantasy contribution is traceable to a game record in `data/game-contributions.json`. The interface labels the database **Exact game-event sync** only after the Crosby, Malkin, and Cowan validation checks all pass; otherwise it displays a visible audit warning. Player names, positions, and current-team identity are enriched from the official league-wide NHL reports, while the browser-facing player file keeps only the 15 most recent game rows per player for speed. The complete game contribution cache remains available for auditing and future recalculation.
