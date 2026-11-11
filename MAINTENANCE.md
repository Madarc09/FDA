# Data, artwork and future editing

## Separation of concerns

`api/hockey.js` is the only public serverless entry point. It accepts a small allowlist of resource types and validates dates and NHL IDs; it is not an arbitrary URL proxy. `server/nhl.mjs` retrieves reports, `shared/normalize.mjs` translates upstream schemas, and React components consume those normalized objects.

Card definitions in `data/collection.json` are permanent design records. Each has its own card ID, NHL player ID, set ID, edition, design version, issued-for team, original name/number/position and separate image references. All 20 curated cards include local copies of the original photos, Toronto logo and versioned frame. A player transfer changes the live player file, not the issued Toronto card.

The biography, NHL history and career totals are live data layers. They are deliberately not painted into the artwork. `Card.jsx` is the central layout for both sides. `stat-columns.mjs` centrally defines statistical headings, formatting and default sorting directions.

For a new set, create new card definitions and versioned art paths; never replace existing images or silently overwrite an issued card definition. Preserve an existing layout version if a future collectible system needs its original rendering. Ownership should eventually be stored on a separate card-instance record, keyed by instance ID and card-definition ID. Rarity and gameplay fields are reserved as null; they do not imply implemented gameplay, scarcity, ownership or minting.

## Manual lineups

Edit `data/toronto-lineup.json` in GitHub and redeploy. Use NHL player IDs, never Daily Faceoff IDs. Required groups are `f1`–`f4` (three players each), `d1`–`d3` (two each), and `g` (two). The two goalie slots are projection order, not a confirmed starter announcement. Optional groups are `pp1`, `pp2` (five) and `pk1`, `pk2` (four).

Keep `team` as `TOR`; set `status` to `projected` or, only with explicit reliable confirmation, `confirmed`. Update `sourceName`, `sourceUrl` and `sourceUpdatedAt` (ISO time including timezone). Add `validUntil` with an ISO timestamp if the projection should expire earlier than the normal 36-hour age limit. Each entry needs `id`, `name` and `slot`; preserve the slot format in the supplied file. Required groups must contain exactly 20 unique current-roster players.

Set Vercel's server-side `LINEUP_SOURCE` environment variable to `manual` to prioritize this file. Leave it unset or `auto` for automatic sources. This setting never makes a dated file current: the UI still shows its source, time, manual status and expiry warning. If the file cannot validate against the roster, the app shows the roster without inventing combinations.

`npm run snapshots:update` deliberately refreshes the saved projection and player profiles from live sources before a release. It refuses a stale or fallback projection and does not alter card identities or photography. Commit the two changed JSON files after reviewing the update. No scheduled refresh service or database is required for normal live operation.

## Verified sources and fallback order

Checked against real responses on November 8, 2026:

- NHL web data: `https://api-web.nhle.com/v1/standings/now`, `/roster/TOR/current`, `/player/{id}/landing`, `/score/now`, `/score/{date}`, `/gamecenter/{id}/landing`, `/boxscore`, and `/right-rail`.
- NHL statistics: `https://api.nhle.com/stats/rest/en/` with team `summary`, `realtime`, `powerplay`; skater `summary`, `realtime`; goalie `summary`. Regular season uses `gameTypeId=2`. The season follows the official standings rather than a hardcoded calendar assumption. `NHL_SEASON` is an optional server override.
- Primary projected lines: [Daily Faceoff's public Toronto page](https://www.dailyfaceoff.com/teams/toronto-maple-leafs/line-combinations). The adapter reads the ordinary public HTML, including the page's embedded data, after checking `robots.txt`. It does not call an undocumented private API, bypass restrictions, log in or solve access challenges. No public API, license to redistribute lineups, or contractual reliability guarantee was established. Robots permission is a technical crawling rule, not a content license.
- Secondary lines: the current [NHL.com projected-lineups article](https://www.nhl.com/news/nhl-lineup-projections-2026-27-season). The adapter checks that its Toronto section exists and its article update is from the current Toronto calendar date. Incomplete or ambiguous mappings are rejected.
- Final fallback: the dated local projection. If live roster validation is also unavailable, the saved roster is used and the result is explicitly marked as saved. The original snapshot is not represented as a confirmed current lineup.

No paid provider integration is included. The public NHL website APIs are not a documented third-party service contract. If an upstream schema or access policy changes, update the relevant server adapter or use the manual lineup option.

## Statistical correctness

Reports are fetched in full, checked against the reported total and checked for duplicate IDs. If an upstream service caps a response, pagination retrieves the remaining rows. Sorting and filtering use that full dataset in the browser; pagination only controls rendering.

Percentages use the source's fractional units. Goalie minutes are derived from official seconds; average skater TOI is shown as minutes:seconds. Lower-is-better columns have explicit defaults. Missing values remain null and render as an em dash, sorting last in either direction. Multi-team players retain whole-season totals and match every reported team in filters. Current standings streaks and last-ten records may update separately from statistics reports.

Game scoring events and penalties are chronological. Power-play, short-handed and empty-net markers come from explicit official fields. Current manpower/PP status is taken from the scoreboard's live `situation` field; a historical penalty is never treated as proof of an active advantage. When the NHL does not explicitly flag a starting goalie, the page says Played, Available or unconfirmed. It does not label a pregame goalie comparison as a confirmed start.

## Requests, caching and failures

The browser caches and deduplicates resources, sorts locally, loads player histories on demand and lazily loads offscreen images. Active game polling is approximately every 30 seconds, reduced to two minutes for inactive games, and paused while the page is hidden. Returning to the tab refreshes it. The clock is the last official value, not a fabricated locally advancing clock.

Server caches deduplicate work per warm function instance; Vercel CDN caching adds shared request reduction. Statistics refresh around five minutes, rosters ten minutes, lineups fifteen minutes, player files one hour and game feeds twenty seconds. These are not a persistent database. Cached or bundled fallbacks retain their original timestamp and display warnings. No fake score or statistical dataset is substituted when league data is unavailable.

## Artwork and rights

The navy/cream/red frame, arena atmosphere and Original Set logo were created for this rebuild. NHL player photography and team logos are official-source assets; exact URLs, hashes and photo audit notes are in `data/art-provenance.json`. Twelve player action photographs were verified as distinct images; eight players use one portrait on both sides. Generic arena photos returned by some player hero URLs were rejected.

Font license texts are included beside the self-hosted fonts. NHL imagery, team marks and third-party lineup content retain their owners' rights; this project does not grant commercial trading-card merchandising rights or claim league affiliation.

## Original archive inspection

The supplied 37-file draft website was inspected before rebuilding. Its working NHL endpoint patterns and Vercel deployment approach informed the new service layer. Its fantasy-draft rules, old interface and unrelated assets were not carried into this separate project. The delivered source contains only this rebuild.
