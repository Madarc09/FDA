import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playersFile = path.join(ROOT, 'data', 'players.json');
const validationFile = path.join(ROOT, 'data', 'validation.json');
const EXPECTED = [
  { id: 8471675, name: 'Sidney Crosby', fantasyPoints: 403.0 },
  { id: 8471215, name: 'Evgeni Malkin', fantasyPoints: 314.6 },
  { id: 8484153, name: 'Easton Cowan', fantasyPoints: 184.1 }
];

const payload = JSON.parse(await fs.readFile(playersFile, 'utf8'));
const byId = new Map((payload.players || []).map(player => [Number(player.id || player.playerId), player]));
const checks = EXPECTED.map(expected => {
  const player = byId.get(expected.id);
  const actual = player ? Number(player.fantasyPoints) : null;
  const difference = actual == null ? null : Number((actual - expected.fantasyPoints).toFixed(2));
  return {
    ...expected,
    actual,
    difference,
    passed: actual != null && Math.abs(difference) <= 0.01
  };
});
const passed = checks.every(check => check.passed);
const validation = {
  checkedAt: new Date().toISOString(),
  season: String(payload.season || ''),
  passed,
  checks,
  message: passed
    ? 'The automated NHL event collector reproduced all three independently verified Fantrax totals.'
    : 'At least one verified Fantrax total did not match. Inspect the category and game audit before treating the sync as exact.'
};

payload.metadata = { ...(payload.metadata || {}), validation };
for (const player of payload.players || []) {
  player.dataQuality = passed ? 'exact' : 'event-sync-unvalidated';
}
await fs.writeFile(playersFile, JSON.stringify(payload, null, 2) + '\n');
await fs.writeFile(validationFile, JSON.stringify(validation, null, 2) + '\n');

console.log(validation.message);
for (const check of checks) {
  console.log(`${check.name}: expected ${check.fantasyPoints.toFixed(1)}, actual ${check.actual == null ? 'missing' : check.actual.toFixed(1)}, ${check.passed ? 'PASS' : 'FAIL'}`);
}
if (!passed) console.log('The data files remain available with an unvalidated label so the exact mismatch can be audited.');
