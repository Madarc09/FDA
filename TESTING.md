# Verification record

## Completed checks

- Production Vite build passed. The final source was also extracted from the delivery ZIP and built from a clean dependency installation.
- All 17 automated tests passed, including a separate run on Node.js 22. Tests cover every numerical sorting configuration, null handling, filters, formatting, NHL identity mapping, lineup validation, source crawling rules, game chronology, explicit power-play/starter flags, card assets, request validation, cache deduplication, retry recovery and an upstream-outage fallback.
- Live API verification on November 8, 2026 returned 32 teams, 755 skaters and 75 goalies for 2026–27, without partial supplementary reports. The actual Matthews biography/history, automatic Daily Faceoff projection, scoreboard and game-detail feeds were checked. Counts will naturally change during the season.
- The saved Toronto projection and 28 player profiles were refreshed from live sources at `2026-11-08T19:15:16.431Z`. The projection's source update was `2026-11-08T16:11:53.670Z`. These are explicitly dated fallbacks, not a claim that the bundled files remain current indefinitely.
- Desktop browser checks covered homepage navigation, the 32-team directory, Toronto forward/defence/goalie/PP/PK tabs, card flipping in both directions, enlarged player files, and a non-Toronto player file with actual career history.
- Browser sorting checks covered team power-play percentage in both directions and goals for, player goals/assists, goalie GAA ascending and save percentage descending. Player name search, combined team/position filters, reset and goalie minimum-games filters worked against live data.
- The live Florida–Boston game view updated its official clock and retrieval timestamp automatically without page navigation. Explicit power-play status, goalie game numbers, team comparisons, chronological goals and penalties rendered. Historical scores showed all 12 November 7 games as final. The New Jersey–Toronto pregame view correctly kept goalie starting assignments unconfirmed.
- Responsive checks used 320, 390 and 768 pixel browser frames plus the full desktop viewport. Homepage, Toronto cards, enlarged cards, statistics and game views had no unintended page-width overflow. Statistical tables scrolled inside their own regions. Mobile navigation and tap-style card controls worked. Reduced-motion behavior is implemented in CSS and animation guards.
- Official player-image URLs were checked. The 20 curated identities and their local front/back assets were validated; 12 have different photographs. The final lossless WebP branding assets loaded successfully. No browser screenshots or test-harness pages are included in the release.
- The ZIP's CRC integrity, root-level structure, required files and exclusion of dependency/build folders were verified before delivery.

## Scope of verification

Live-data checks and browser checks used real upstream responses. Deterministic tests use captured NHL/DFO response fragments; outage tests deliberately simulate a failed upstream request. Those fixtures are not served to website users as live data.

Temporary test-server interruptions were resolved before completing browser checks. The final project has not been deployed into the user's Vercel account, and no claim is made of an account-level deployment test. Native iPhone/Safari hardware, an installed PWA, exhaustive screen-reader behavior, future upstream API changes and an actual goal-triggered animation were not independently exercised. The current delivery is a responsive website, not an offline app or trading game.

Run `npm test`, `npm run build` and `npm run verify:live` for repeatable checks. Live verification needs working access to the NHL and lineup sources and reports the actual results rather than substituting fixtures.
