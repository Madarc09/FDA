import fs from 'node:fs';

const file=new URL('../data/SALARY_CAP_SPACE.json',import.meta.url);
const payload=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=Array.isArray(payload)?payload:(payload.records||payload.players||payload.data||[]);
if(!rows.length)throw new Error('No salary records found.');

const salary=row=>Number(row.salary??row.capHit??row['2026-27 Salary']??0);
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
const pos=value=>{const p=String(value||'').toUpperCase();return p==='G'?'G':['D','LD','RD'].includes(p)?'D':'F';};
const team=value=>({NAS:'NSH',WAS:'WSH'}[String(value||'').toUpperCase()]||String(value||'').toUpperCase());

const bad=rows.filter(row=>!Number.isFinite(salary(row))||salary(row)<0);
if(bad.length)throw new Error(`${bad.length} salary rows are invalid.`);

const exactKeys=new Set();
const namePositionKeys=new Set();
for(const row of rows){
  const name=row.player??row.Player??row.name??row.Name;
  const exact=[team(row.team??row.Team),normalize(name),pos(row.position??row.Position)].join('|');
  const namePosition=[normalize(name),pos(row.position??row.Position)].join('|');
  if(exactKeys.has(exact))throw new Error(`Duplicate salary key: ${exact}`);
  if(namePositionKeys.has(namePosition))throw new Error(`Ambiguous normalized name/position key: ${namePosition}`);
  exactKeys.add(exact);
  namePositionKeys.add(namePosition);
}

const teams=new Set(rows.map(row=>team(row.team??row.Team)));
const signed=rows.filter(row=>salary(row)>0).length;
const unsigned=rows.filter(row=>salary(row)===0).length;
if(rows.length!==2197)throw new Error(`Expected 2,197 rows, found ${rows.length}.`);
if(teams.size!==32)throw new Error(`Expected 32 teams, found ${teams.size}.`);
if(signed!==1425)throw new Error(`Expected 1,425 signed rows, found ${signed}.`);
if(unsigned!==772)throw new Error(`Expected 772 unsigned rows, found ${unsigned}.`);

const byNamePosition=new Map(rows.map(row=>[[normalize(row.name??row.player),pos(row.position)].join('|'),row]));
const keepers=[
  ['Matvei Michkov','F',950000],
  ['Leo Carlsson','F',18000000],
  ['Adam Fantilli','F',0],
  ['Michael Misa','F',986250],
  ['Sam Dickinson','D',953750],
  ['Noah Dobson','D',9500000],
  ['Quinn Hughes','D',7850000],
  ['Charlie McAvoy','D',9500000],
  ['Yaroslav Askarov','G',2000000],
  ['Mackenzie Blackwood','G',5250000],
  ['James Hagens','F',986250],
  ['Ilya Protas','F',932500]
];
for(const [name,position,expected] of keepers){
  const row=byNamePosition.get(`${normalize(name)}|${position}`);
  if(!row)throw new Error(`Keeper salary missing: ${name}`);
  if(salary(row)!==expected)throw new Error(`Keeper salary mismatch for ${name}: expected ${expected}, found ${salary(row)}.`);
}

console.log(`Salary validation passed: ${rows.length} records, ${signed} signed, ${unsigned} unsigned, ${teams.size} teams, all keeper matches confirmed.`);
