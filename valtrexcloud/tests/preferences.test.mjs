import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, readPreferences, filterApps, filterLogs, logsCsv, safeInvite } from '../src/preferences.mjs';
import { displayName } from '../src/branding.mjs';
test('preferences have a limited schema and survive blocked or corrupt storage',()=>{
 assert.equal(normalizePreferences({palette:'__proto__',density:'tiny',token:'secret'}).palette,'mint');
 assert.equal('token' in normalizePreferences({token:'secret'}),false);
 assert.equal(readPreferences({getItem(){throw Error('blocked')}}).layout,'grid');
 assert.equal(readPreferences({getItem(){return '{broken'}}).sort,'name');
 assert.equal(readPreferences({getItem(){return '{"palette":"blue","reducedMotion":true}'}}).reducedMotion,true);
});
test('application filtering and expiry ordering preserve the source list',()=>{
 const apps=[{label:'Zulu',id:'2',status:'active',expiresAt:null},{label:'Aurora',id:'1',status:'expired',expiresAt:'2020-01-01'}];
 assert.equal(filterApps(apps,'aurora')[0].id,'1');
 assert.equal(filterApps(apps,'','active').length,1);
 assert.equal(filterApps(apps,'','all','expiry')[0].id,'1');
 assert.equal(apps[0].id,'2');
 assert.equal(filterApps(apps,'not-found').length,0);
});
test('activity filters loaded events and CSV cannot introduce spreadsheet formulas or private fields',()=>{
 const events=[{event:'gift_created',created_at:'2026-10-26T12:00:00Z',secret:'must-not-export'},{event:'=RUN()',created_at:'2026-10-27T12:00:00Z'}];
 assert.equal(filterLogs(events,'gift').length,1);
 assert.equal(filterLogs(events,'','2026-10-27').length,1);
 const csv=logsCsv(events);assert.match(csv,/'=RUN\(\)/);assert.ok(!csv.includes('must-not-export'));
});
test('support links accept only HTTPS Discord invites',()=>{
 for(const value of ['javascript:alert(1)','https://discord.gg.evil.test/cloud','https://discord.gg:8443/cloud','https://user@discord.gg/cloud'])assert.equal(safeInvite(value),null);
 assert.equal(safeInvite('https://discord.gg/cloud'),'https://discord.gg/cloud');
});
test('legacy public branding becomes Cloud without altering custom names',()=>{
 assert.equal(displayName('ValtrexCloud'),'Cloud');assert.equal(displayName('ValtrexApplications'),'Cloud');assert.equal(displayName('Minha Loja'),'Minha Loja');
});
