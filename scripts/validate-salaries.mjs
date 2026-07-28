import fs from 'node:fs';
const file=new URL('../data/SALARY_CAP_SPACE.json',import.meta.url);
const payload=JSON.parse(fs.readFileSync(file,'utf8'));
const rows=Array.isArray(payload)?payload:(payload.records||payload.players||payload.data||[]);
if(!rows.length)throw new Error('No salary records found.');
const salary=row=>Number(row.salary??row.capHit??row['2026-27 Salary']??0);
const bad=rows.filter(row=>!Number.isFinite(salary(row))||salary(row)<0);
if(bad.length)throw new Error(`${bad.length} salary rows are invalid.`);
const normalize=value=>String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
const pos=value=>{const p=String(value||'').toUpperCase();return p==='G'?'G':['D','LD','RD'].includes(p)?'D':'F';};
const team=value=>({NAS:'NSH',WAS:'WSH'}[String(value||'').toUpperCase()]||String(value||'').toUpperCase());
const keys=new Set();
for(const row of rows){const key=[team(row.team??row.Team),normalize(row.player??row.Player??row.name),pos(row.position??row.Position)].join('|');if(keys.has(key))throw new Error(`Duplicate salary key: ${key}`);keys.add(key);}
console.log(`Salary validation passed: ${rows.length} records, ${rows.filter(row=>salary(row)>0).length} signed, ${rows.filter(row=>salary(row)===0).length} unsigned.`);
