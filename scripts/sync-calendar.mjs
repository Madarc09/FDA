import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScheduleDataset } from '../lib/calendar-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const season = process.env.NHL_SCHEDULE_SEASON || '20262027';
const payload = await buildScheduleDataset(season);
await fs.mkdir(path.join(root, 'data'), { recursive: true });
await fs.writeFile(path.join(root, 'data', 'calendar-analysis.json'), `${JSON.stringify(payload)}\n`);
console.log(`Saved ${payload.metadata.gameCount} official NHL games for ${season}.`);
