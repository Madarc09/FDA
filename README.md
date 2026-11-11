# The Original Set

A complete React hockey website with a vintage Toronto card collection, live NHL game centre, and league-wide team, player and goalie leaderboards.

## Deploy with GitHub and Vercel

1. Extract this ZIP. Upload its **contents** to the root of a GitHub repository. `package.json`, `vercel.json`, `api`, `src` and `public` should be at the repository root. Upload the extracted files, not the ZIP itself.
2. In Vercel, import that repository. Choose **Vite** and leave Root Directory at the repository root.
3. Build command: **`npm run build`**. Output directory: **`dist`**. Node.js: **22.x**. Vercel installs dependencies from the included lockfile.
4. Deploy. **No API keys or environment variables are required.** The single included Vercel function supplies same-origin NHL data. GitHub Pages or opening `index.html` directly cannot run that function.

The project fits within one 100-file browser upload batch. Do not upload `node_modules` or a local `dist` folder.

## Local development

```sh
npm ci
npm run dev
```

Vite runs the same API handler locally. `npm run build` creates the production assets; `npm run preview` serves them with the API handler. `npm test` runs deterministic data and failure-path tests. `npm run verify:live` checks the actual upstream services.

## What is included

- An arena-themed homepage, team directory, and 20 curated Toronto cards with separate front/back artwork and editable data layers. Cards flip with touch, mouse, Space or Enter; the enlarged player file shows the full career ledger.
- Toronto forward lines, defence pairings, goalies, power-play and penalty-kill units with source and update time. All automatically sourced assignments are explicitly **projected**.
- All available current-season NHL team, skater and goalie statistics, immediate sorting, search, filters, pagination and goalie minimum-game qualifiers.
- Date-selectable scores, live polling, manual refresh, individual game scoreboards, goalie information, team comparisons, scoring and penalty logs.
- Responsive layouts, keyboard controls, reduced-motion support and self-hosted fonts. A manifest is included as a starting point for future app support; offline operation and a native app are not included.

## Editing the project

| Area | Main location |
| --- | --- |
| Card layout, both sides | `src/components/Card.jsx`, `src/styles/card.css` |
| Permanent card identities and frozen images | `data/collection.json`, `public/art/` |
| Colours, fonts and motion | `src/styles/theme.css`, `fonts.css`, `pages.css` |
| Available statistics and sort direction | `shared/stat-columns.mjs` |
| API communication and caching | `server/http.mjs`, `server/nhl.mjs` |
| Lineup adapters and validation | `server/lineups.mjs` |
| Manual / saved lineup | `data/toronto-lineup.json` |
| Dated player fallback | `data/toronto-players.json` |

See `MAINTENANCE.md` for manual lineup instructions, card identity rules and source limitations. `TESTING.md` records what was checked.

## Important limits

The NHL website feeds and Daily Faceoff public page can change or become unavailable. Failures are shown honestly; Toronto has a dated saved fallback, and a manual configuration is supported. Daily Faceoff has no verified public API or service guarantee. Twelve Toronto cards have distinct action and portrait photos; eight intentionally use one verified official portrait on both sides. Other players use an official-headshot player file. No collectible ownership system or trading game is implemented.
