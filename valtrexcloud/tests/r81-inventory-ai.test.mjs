import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,user,second,app,other} from './helpers/edge.mjs';
import {ownedApps,resolveApplication,searchApplications} from '../src/application-model.mjs';
const fresh='3500042139491635200',owner='32345678901234567';
const row=(botId=fresh,ownerId=user,id='new-buxx')=>({id,botId,ownerId,label:'Minha loja Buxx',profile:'robux',status:'active',expiresAt:'2099-01-01T00:00:00Z'});
const sync=(f,apps)=>f.call('manager/sync',{auth:'manager',method:'POST',data:{apps}});
test('Manager inventory creates an owned workspace before the child bot connects, without exposing its provisional key',async()=>{
  const f=await fixture();assert.equal((await sync(f,[row()])).status,200);
  const me=await f.call('portal/me');assert.ok(me.body.apps.some(a=>a.id===fresh));assert.ok(me.body.managedApps.some(a=>a.bot_id===fresh));assert.ok(!JSON.stringify(me.body).includes('bot_key_hash'));
  assert.equal((await f.call(`portal/apps/${fresh}/workspace`)).status,200);assert.equal((await f.call(`portal/apps/${other}/workspace`)).status,404);
  const tenant=f.tables.valtrex_tenants.find(a=>a.id===fresh);assert.equal(tenant.owner_user_id,user);assert.match(tenant.bot_key_hash,/^[a-f0-9]{64}$/);assert.ok(!tenant.bot_seen_at);
});
test('legacy inventory is repaired when the owner enters the site and cannot claim an ambiguous bot',async()=>{
  const f=await fixture();f.tables.valtrex_managed_apps=[{manager_app_id:'old',bot_id:fresh,label:'Bot antigo',owner_user_id:user,profile:'sales'}];
  assert.ok((await f.call('portal/me')).body.apps.some(a=>a.id===fresh));
  const f2=await fixture();f2.tables.valtrex_managed_apps=[{manager_app_id:'one',bot_id:fresh,owner_user_id:user},{manager_app_id:'two',bot_id:fresh,owner_user_id:second}];
  assert.ok(!(await f2.call('portal/me')).body.apps.some(a=>a.id===fresh));assert.ok(!f2.tables.valtrex_tenants.some(a=>a.id===fresh));
});
test('inventory preserves real bot keys, existing settings and a different registered owner',async()=>{
  const f=await fixture(),before=structuredClone(f.tables.valtrex_tenants);
  f.tables.valtrex_tenants[0].theme={name:'Minha marca'};
  await sync(f,[row(app),row(other,user,'not-mine')]);
  assert.equal(f.tables.valtrex_tenants[0].bot_key_hash,before[0].bot_key_hash);assert.deepEqual(f.tables.valtrex_tenants[0].theme,{name:'Minha marca'});assert.equal(f.tables.valtrex_tenants[1].owner_user_id,second);
  assert.equal((await f.call(`portal/apps/${other}/workspace`)).status,404);assert.equal((await f.call('bot/workspace/config',{auth:'bot'})).status,200);
});
test('a bot can bootstrap normally after inventory registration without losing its selected owner',async()=>{
  const f=await fixture();await sync(f,[row()]);const initial=f.tables.valtrex_tenants.find(t=>t.id===fresh).bot_key_hash;
  f.setFetch(async()=>Response.json({id:fresh,bot:true,username:'Buxx conectado'}));const result=await f.call('bootstrap',{method:'POST',auth:'manager'});
  assert.equal(result.status,200);assert.equal(result.body.applicationId,fresh);assert.equal(f.tables.valtrex_tenants.find(t=>t.id===fresh).owner_user_id,user);assert.notEqual(f.tables.valtrex_tenants.find(t=>t.id===fresh).bot_key_hash,initial);
});
test('AI grant by user ID also works for a newly registered workspace, independent of administration',async()=>{
  const f=await fixture();f.tables.valtrex_manager_web=[{id:1,site_owner_ids:[owner]}];
  await f.call('manager/site/access/users',{method:'POST',auth:'manager',data:{actorId:owner,userId:user,scope:'ai',enabled:true,tickets:true,community:false}});
  await sync(f,[row()]);const result=await f.call(`portal/apps/${fresh}/workspace`);
  assert.equal(result.body.aiAccess.allowed,true);assert.equal(result.body.aiAccess.tickets,true);assert.equal(result.body.aiAccess.community,false);assert.equal((await f.call('portal/me')).body.isPlatformAdmin,false);
});
test('global pause is visible to the site without revoking user grants or erasing prompts',async()=>{
  const f=await fixture();f.tables.valtrex_manager_web=[{id:1,site_owner_ids:[owner]}];f.tables.valtrex_site_user_access=[{user_id:user,ai_managed:true,ai_enabled:true,ai_tickets:true,ai_community:true}];
  const before=await f.call(`portal/apps/${app}/workspace`);
  const toggle=enabled=>f.call('manager/site/ai/service',{method:'POST',auth:'manager',data:{enabled,actorId:owner}});
  assert.equal((await toggle(false)).status,200);const paused=await f.call(`portal/apps/${app}/workspace`);
  assert.equal(paused.body.aiAccess.allowed,true);assert.equal(paused.body.aiAccess.globalEnabled,false);assert.deepEqual(paused.body.cloudAI,before.body.cloudAI);
  assert.equal((await toggle(true)).status,200);assert.equal((await f.call(`portal/apps/${app}/workspace`)).body.aiAccess.globalEnabled,true);
});
test('global hosted AI changes require both Manager authentication and a configured owner actor',async()=>{
  const f=await fixture();f.tables.valtrex_manager_web=[{id:1,site_owner_ids:[owner]}];
  for(const auth of ['portal','bot','none'])assert.equal((await f.call('manager/site/ai/service',{method:'POST',auth,data:{enabled:false,actorId:owner}})).status,401);
  assert.equal((await f.call('manager/site/ai/service',{method:'POST',auth:'manager',data:{enabled:false,actorId:user}})).status,403);assert.equal(f.tables.valtrex_ai_service?.length||0,0);
});
test('application selector includes pending bots and preserves their identity after Cloud connects',()=>{
  const state={apps:[{id:app,label:'Sallers'}],managedApps:[{manager_app_id:'new-buxx',bot_id:fresh,label:'Buxx',profile:'robux',status:'active'}]};
  const before=ownedApps(state);assert.equal(before.length,2);assert.equal(before[0].cloudId,null);
  state.apps.push({id:fresh,label:'Buxx'});const after=ownedApps(state),selected=resolveApplication(after,before[0].key);
  assert.equal(after.length,2);assert.equal(selected.key,before[0].key);assert.equal(selected.cloudId,fresh);assert.equal(searchApplications(after,'robux').length,1);assert.equal(searchApplications(after,fresh).length,1);
  assert.equal(resolveApplication(after,'cloud:'+app).cloudId,app);
});
