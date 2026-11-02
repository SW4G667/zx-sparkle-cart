import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {fixture,app,other,user} from './helpers/edge.mjs';
import {operationDefaults,normalizeOperations,parseStockFile,payloadDigest} from '../src/operations90.mjs';
import {expiryStatus90} from '../src/expiry90.mjs';

test('expiry shows all remaining days, the final day, expiration and an unknown deadline accurately',()=>{
 const now=Date.parse('2026-11-02T00:00:00Z');assert.equal(expiryStatus90('2026-11-12',now).days,10);assert.match(expiryStatus90('2026-11-02T01:00:00Z',now).label,/Último dia/);assert.equal(expiryStatus90('2026-11-01',now).state,'expired');assert.equal(expiryStatus90(null,now).days,null);
});
test('wallet is visibly disabled without configuration and cannot accept a withdrawal',async()=>{
 const f=await fixture();let result=await f.call(`portal/apps/${app}/operations/wallet`);assert.equal(result.status,200);assert.equal(result.body.wallet.enabled,false);assert.equal(result.body.wallet.availableCents,null);
 const value={clientId:randomUUID(),amountCents:100,pixKeyType:'EMAIL',pixKey:'owner@example.org'},data=await challenge(f,'wallet_withdraw',app,value);
 result=await f.call(`portal/apps/${app}/operations/wallet/withdraw`,{method:'POST',data});assert.equal(result.status,409);assert.equal(f.tables.valtrex_operation_commands?.length||0,0);
});
test('wallet withdrawals require ownership, fresh balance, a bound confirmation and encrypted idempotent commands',async()=>{
 const f=await fixture();f.tables.valtrex_workspace_state=[{tenant_id:app,seen_at:new Date().toISOString(),telemetry:{wallet:{enabled:true,state:'ready',availableCents:5000,pendingCents:0,withdrawableCents:4000,at:Math.floor(Date.now()/1000)}}}];
 const payload={clientId:randomUUID(),amountCents:1500,pixKeyType:'EMAIL',pixKey:'private-owner@example.org'};
 assert.equal((await f.call(`portal/apps/${app}/operations/wallet/withdraw`,{method:'POST',data:payload})).status,409);
 const data=await challenge(f,'wallet_withdraw',app,payload),result=await f.call(`portal/apps/${app}/operations/wallet/withdraw`,{method:'POST',data});assert.equal(result.status,202);assert.equal(f.tables.valtrex_operation_commands[0].kind,'wallet_withdraw');assert.ok(!JSON.stringify(f.tables.valtrex_operation_commands).includes(payload.pixKey));
 assert.equal((await f.call(`portal/apps/${app}/operations/wallet/withdraw`,{method:'POST',data:payload})).body.repeated,true);
 assert.equal((await f.call(`portal/apps/${app}/operations/wallet/withdraw`,{method:'POST',data:{...payload,amountCents:1600}})).status,409);
 assert.equal((await f.call(`portal/apps/${other}/operations/wallet`)).status,404);
 const history=await f.call(`portal/apps/${app}/operations/wallet`);assert.ok(!JSON.stringify(history.body).includes(payload.pixKey));
});

async function challenge(f,action,scope,payload){const r=await f.call('portal/security/challenge',{method:'POST',data:{action,scope,digest:await payloadDigest(payload)}});assert.equal(r.status,200);const row=f.tables.valtrex_operation_confirmations.find(item=>item.id===r.body.id);row.expires_at='2099-01-01';return {...payload,confirmationId:r.body.id};}
test('stock TXT and quoted CSV remove duplicates, never reveal data in the preview, and reject malformed rows',()=>{
 const r=parseStockFile('item;quantidade\n"email:senha;extra";1\n"email:senha;extra";1\n','csv');assert.deepEqual(r.entries,['email:senha;extra']);assert.equal(r.duplicates,1);assert.ok(!JSON.stringify(r.preview).includes('senha'));
 assert.throws(()=>parseStockFile('"unclosed','csv'));assert.throws(()=>parseStockFile('x\0y'));assert.throws(()=>parseStockFile(Array(502).fill('').map((_,i)=>String(i)).join('\n')));
});
test('operation settings require ownership and never include AI or bot secrets',async()=>{
 const f=await fixture();assert.equal((await f.call(`portal/apps/${other}/operations`)).status,404);const r=await f.call(`portal/apps/${app}/operations`);assert.equal(r.status,200);assert.equal(r.body.config.receipt.model,'confirmed');assert.equal(r.body.status.online,false);assert.ok(!JSON.stringify(r.body).includes('key_cipher'));
});
test('saving produces a history version and rejects stale updates and unsafe settings',async()=>{
 const f=await fixture(),config=structuredClone(operationDefaults);config.receipt.model='image';const r=await f.call(`portal/apps/${app}/operations/studio`,{method:'PUT',data:{revision:null,config}});assert.equal(r.status,200);assert.match(r.body.revision,/[a-f0-9-]{36}/);
 assert.equal((await f.call(`portal/apps/${app}/operations/studio`,{method:'PUT',data:{revision:null,config}})).status,409);
 config.receipt.backgroundImage='http://localhost/x';assert.equal((await f.call(`portal/apps/${app}/operations/studio`,{method:'PUT',data:{revision:r.body.revision,config}})).status,400);
 assert.equal(f.tables.valtrex_operation_history[0].actor_id,user);
});
test('restoration is bound to a tenant, session, selected version and current revision',async()=>{
 const f=await fixture(),config=structuredClone(operationDefaults);const saved=await f.call(`portal/apps/${app}/operations/studio`,{method:'PUT',data:{revision:null,config}}),id=f.tables.valtrex_operation_history[0].id;
 assert.equal((await f.call(`portal/apps/${app}/operations/restore`,{method:'POST',data:{id,revision:saved.body.revision}})).status,409);
 const payload=await challenge(f,'restore',app,{id,revision:saved.body.revision});const result=await f.call(`portal/apps/${app}/operations/restore`,{method:'POST',data:payload});assert.equal(result.status,200);
 assert.equal((await f.call(`portal/apps/${app}/operations/restore`,{method:'POST',data:payload})).status,409);
});
test('stock import is encrypted, privately claimed by the tenant bot and acknowledged with the correct lease',async()=>{
 const f=await fixture(),id=randomUUID(),secret='buyer@example.com:never-log-this:token';
 const input={clientId:id,productId:'p1',fieldId:'monthly',entries:[secret]};const payload=await challenge(f,'stock_import',app,input);
 const queued=await f.call(`portal/apps/${app}/operations/stock`,{method:'POST',data:payload});assert.equal(queued.status,202);assert.ok(!JSON.stringify(f.tables).includes(secret));
 const read=await f.call(`portal/apps/${app}/operations`);assert.ok(!JSON.stringify(read.body).includes('payload_cipher'));assert.ok(!JSON.stringify(read.body).includes(secret));
 const claim=await f.call('bot/workspace/operations/claim',{method:'POST',auth:'bot'});assert.equal(claim.status,200);assert.deepEqual(claim.body.commands[0].payload.entries,[secret]);
 const cmd=claim.body.commands[0];assert.equal((await f.call('bot/workspace/operations/result',{method:'POST',auth:'bot',data:{id,lease:randomUUID(),state:'applied'}})).status,409);
 assert.equal((await f.call('bot/workspace/operations/result',{method:'POST',auth:'bot',data:{id,lease:cmd.lease,state:'applied'}})).status,200);
 assert.equal((await f.call(`portal/apps/${app}/operations/stock`,{method:'POST',data:payload})).body.repeated,true);
 const changed={...payload,entries:['a different item']};assert.equal((await f.call(`portal/apps/${app}/operations/stock`,{method:'POST',data:changed})).status,409);
});
test('tampering with a confirmed stock batch prevents its import',async()=>{
 const f=await fixture(),payload=await challenge(f,'stock_import',app,{clientId:randomUUID(),productId:'p1',fieldId:'one',entries:['private']});payload.entries=['different'];assert.equal((await f.call(`portal/apps/${app}/operations/stock`,{method:'POST',data:payload})).status,409);assert.equal(f.tables.valtrex_operation_commands?.length||0,0);
});
test('heartbeat permits measured values only, strips secrets and distinguishes configured from connected',async()=>{
 const f=await fixture();const r=await f.call('bot/workspace/heartbeat',{method:'POST',auth:'bot',data:{runtime:'javascript',telemetry:{version:'R90',rssMb:144.5,heapMb:34,latencyMs:120,services:{discord:'connected',payments:'configured',imap:'secret'},token:'do-not-leak',lastError:{action:'payments:credential','code':'HTTP_503','stack':'private'}}}});assert.equal(r.status,200);
 const data=await f.call(`portal/apps/${app}/operations/status`);assert.equal(data.body.status.telemetry.rssMb,145);assert.equal(data.body.status.telemetry.services.payments,'configured');assert.equal(data.body.status.telemetry.services.imap,'unknown');assert.ok(!JSON.stringify(data.body).includes('do-not-leak'));assert.ok(!JSON.stringify(data.body).includes('stack'));
});
test('domain checks never fetch the supplied host and reject local or malformed names',async()=>{
 const f=await fixture();for(const domain of ['localhost','127.0.0.1','user:pass@evil.com','example.com/path'])assert.equal((await f.call(`portal/apps/${app}/operations/domain`,{method:'POST',data:{domain}})).status,400);
 f.setFetch(async()=>Response.json({Answer:[{type:5,data:'cname.vercel-dns.com.'}]}));const r=await f.call(`portal/apps/${app}/operations/domain`,{method:'POST',data:{domain:'loja.example.com'}});assert.equal(r.status,200);assert.ok(f.networkCalls.every(c=>c.url.startsWith('https://dns.google/resolve?')));assert.equal(r.body.https.state,'verify_in_host');
});
test('sessions expose public identifiers only and another user session cannot be revoked',async()=>{
 const f=await fixture();Object.assign(f.tables.valtrex_portal_sessions[0],{public_id:randomUUID(),created_at:new Date().toISOString(),device:'Android'});const foreign=randomUUID();f.tables.valtrex_portal_sessions.push({session_hash:'foreign',discord_user_id:'99999999999999999',public_id:foreign,expires_at:'2099-01-01'});
 const sessions=await f.call('portal/security/sessions');assert.equal(sessions.body.sessions.length,1);assert.equal(sessions.body.sessions[0].current,true);assert.ok(!JSON.stringify(sessions.body).includes('session_hash'));
 const payload=await challenge(f,'sessions_revoke','self',{id:foreign});assert.equal((await f.call('portal/security/sessions/revoke',{method:'POST',data:payload})).status,404);assert.ok(f.tables.valtrex_portal_sessions.some(s=>s.public_id===foreign));
});
test('imported configuration drops unknown credentials and cannot crash on a malformed automation collection',()=>{
 const value=normalizeOperations({secret:'must-drop',receipt:{model:'image',key:'must-drop',elements:{title:{x:5000,y:-5000,scale:99}}},automations:{invalid:true}});assert.equal(value.receipt.model,'image');assert.equal(value.receipt.elements.title.x,150);assert.equal(value.receipt.elements.title.y,-100);assert.equal(value.receipt.elements.title.scale,1.4);assert.ok(!JSON.stringify(value).includes('must-drop'));assert.deepEqual(value.automations,[]);
});
test('sensitive gateway and OAuth changes require a fresh confirmation tied to their exact payload',async()=>{
 const f=await fixture();f.tables.valtrex_manager_web=[{id:1,administrator_ids:[user],site_owner_ids:[user]}];const data={kind:'gateway_save',payload:{gateway:'goatpay',enabled:false},clientId:randomUUID()};
 const raw=await f.rawCall('portal/platform/commands',{method:'POST',data});assert.equal(raw.status,409);const confirmed=await f.call('portal/platform/commands',{method:'POST',data});assert.equal(confirmed.status,202);
 const attempt=await f.rawCall('portal/platform/auth',{method:'POST',data:{applicationId:app,clientSecret:'fixture-not-a-real-secret'}});assert.equal(attempt.status,409);
});
