# FDA — Fantrax Draft Assist

Version-one visual build for a mobile-first fantasy hockey draft assistant.

## What works now

- Responsive mobile and desktop interface.
- Five interactive sections: Home, Players, Player Lab, Roster, and Settings.
- Search and position filtering.
- Player watchlist toggles.
- Verified Fantrax season totals for the players used during validation.
- Exact category audit for Sidney Crosby, Evgeni Malkin, and Easton Cowan.
- The league's Fantrax scoring preset displayed in Settings.
- Known keeper foundation displayed in the roster builder.

## What is intentionally not live yet

- NHL game importer.
- Salary database connection.
- Fantrax roster synchronization.
- Seven-day prediction model.

Projection signals in this V1 are clearly labelled as design placeholders. Verified season FPTS are real validation totals.

## Deploy to Vercel

This build has no dependencies and no build step.

1. Upload all extracted files to the root of the GitHub repository.
2. Import the repository into Vercel.
3. Use **Other** as the framework preset if Vercel does not detect it automatically.
4. Leave the build command empty.
5. Leave the output directory empty.
6. Deploy.

## Run locally

Open `index.html`, or serve the folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Main files

- `index.html` — page structure.
- `styles.css` — complete responsive design.
- `data.js` — sample players and league scoring.
- `app.js` — navigation, filters, watchlist, and scoring-audit interactions.
- `vercel.json` — clean URL and static caching settings.
