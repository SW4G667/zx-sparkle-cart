import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,app,other,user} from './helpers/edge.mjs';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPa8AAAAASUVORK5CYII=';
const upload=(f,changes={},options={})=>f.call(`portal/apps/${app}/media`,{method:'POST',data:{purpose:'logo',dataUrl:png,...changes},...options});
test('gallery upload is owned, immutable, limited to raster images and reusable',async()=>{
 const f=await fixture(),r=await upload(f);assert.equal(r.status,201);assert.match(r.body.url,new RegExp('/'+app+'/logo-[a-f0-9]{64}\\.png$'));assert.equal(f.media.size,1);
 const bucket=f.storageCalls.find(c=>c.kind==='bucket');assert.equal(bucket.options.public,true);assert.equal(bucket.options.fileSizeLimit,3*1024*1024);assert.ok(!bucket.options.allowedMimeTypes.includes('image/svg+xml'));
 assert.equal((await upload(f)).body.url,r.body.url);assert.equal(f.storageCalls.filter(c=>c.kind==='upload').length,1);
 const config=await f.call(`portal/apps/${app}/config`,{method:'PUT',data:{theme:{logo:r.body.url}}});assert.equal(config.status,200);
 const cleared=await f.call(`portal/apps/${app}/config`,{method:'PUT',data:{theme:{logo:''}}});assert.equal(cleared.status,200);assert.equal((await f.call(`portal/apps/${app}/config`)).body.theme.logo,'');
});
test('upload rejects anonymous users, other owners, bot credentials and missing CSRF before storage',async()=>{
 const f=await fixture();assert.equal((await upload(f,{}, {auth:'none'})).status,401);assert.equal((await upload(f,{}, {auth:'bot'})).status,401);
 assert.equal((await upload(f,{}, {headers:{'x-valtrex-csrf':'wrong'}})).status,403);
 assert.equal((await f.call(`portal/apps/${other}/media`,{method:'POST',data:{purpose:'logo',dataUrl:png}})).status,404);assert.equal(f.storageCalls.length,0);
});
test('invalid image headers, SVG, wrong purpose and oversize content never reach storage',async()=>{
 for(const change of [{purpose:'../another-owner'},{dataUrl:'data:image/svg+xml;base64,'+Buffer.from('<svg/>').toString('base64')},{dataUrl:'data:image/png;base64,'+Buffer.from('not an image'.repeat(5)).toString('base64')},{dataUrl:png.replace('image/png','image/jpeg')},{dataUrl:'data:image/png;base64,'+'A'.repeat(4*1024*1024+16)}]){const f=await fixture();assert.equal((await upload(f,change)).status,400);assert.equal(f.storageCalls.length,0);}
});
test('storage unavailability returns an actionable error without changing the current theme',async()=>{
 const f=await fixture();f.tables.valtrex_tenants[0].theme={logo:'https://cdn.example/keep.png'};f.mediaState.available=false;
 const r=await upload(f);assert.equal(r.status,503);assert.match(r.body.error,/anterior foi preservada/);assert.equal(f.tables.valtrex_tenants[0].theme.logo,'https://cdn.example/keep.png');
});
test('media quota is checked before writing a new object',async()=>{
 const f=await fixture();for(let n=0;n<100;n++)f.media.set(app+'/image-'+n+'.png',{bytes:new Uint8Array(1)});
 assert.equal((await upload(f)).status,409);assert.equal(f.storageCalls.filter(c=>c.kind==='upload').length,0);
});
test('hosted request includes general persona, scope persona and knowledge without enabling private APIs',async()=>{
 const f=await fixture(),guild='123456789012345679',channel='123456789012345678';f.tables.valtrex_tenants[0].guild_id=guild;
 f.tables.valtrex_manager_web=[{id:1,administrator_ids:[user],site_owner_ids:[user]}];f.tables.valtrex_managed_apps=[{bot_id:app,owner_user_id:user,status:'active',expires_at:'2099-01-01'}];
 const initial=(await f.call(`portal/apps/${app}/workspace`)).body;
 assert.equal((await f.call('manager/site/ai/access',{auth:'manager',method:'POST',data:{botId:app,ownerId:user,actorId:user,enabled:true,tickets:true,community:true}})).status,200);
 const persona='Você é Luna, uma personagem feminina que fala de forma simpática.';
 const saved=await f.call(`portal/apps/${app}/workspace`,{method:'PUT',data:{revision:initial.revision,ai:{...initial.ai,enabled:false,systemPrompt:persona,knowledge:'A loja abre às 10h.'},cloudAI:{...initial.cloudAI,enabled:true,communityEnabled:true,communityChannels:[channel],communityPrompt:'Use um tom divertido com os membros.'}}});assert.equal(saved.status,200);
 let payload;f.setFetch(async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({text:'Oi! Eu sou a Luna.',model:'Qwen'});});
 const response=await f.call('bot/workspace/cloud-ai/generate',{auth:'bot',method:'POST',data:{purpose:'community',channelId:channel,guildId:guild,message:'Qual é seu nome?',history:[]}});
 assert.equal(response.status,200);assert.ok(payload.system.includes(persona));assert.ok(payload.system.includes('tom divertido'));assert.ok(payload.system.includes('A loja abre às 10h.'));assert.ok(payload.system.length<=6000);assert.ok(!payload.system.includes('Nunca se descreva'));
});
