import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {fixture,app,user,manager} from './helpers/edge.mjs';
const modelFetch=(f,handler)=>f.setFetch((url,o)=>String(url)==='https://discord.com/api/v10/users/@me'?Promise.resolve(Response.json({id:manager,bot:true})):handler(url,o));
const owner='33333333333333333',root=`portal/apps/${app}/assistant`;
async function ready(){const f=await fixture();f.tables.valtrex_manager_web=[{id:1,site_owner_ids:[owner]}];f.tables.valtrex_site_user_access=[{user_id:user,ai_managed:true,ai_enabled:true,ai_tickets:true,ai_community:true}];assert.equal((await toggle(f,true)).status,200);return f;}
const toggle=(f,enabled)=>f.call('manager/site/ai/service',{method:'POST',auth:'manager',data:{enabled,actorId:owner}});
const chat=async f=>(await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat;
const send=(f,c,clientId=randomUUID())=>f.call(`${root}/chats/${c.id}/messages`,{method:'POST',data:{clientId,revision:c.revision,text:'Como você se chama?',images:[]}});
test('a paused service answers status without contacting Hugging Face and cannot consume a test generation',async()=>{
 const f=await ready(),paused=await toggle(f,false);assert.equal(paused.body.enabled,false);let calls=0;modelFetch(f,async()=>{calls++;throw Error('Hugging Face unavailable');});
 const status=await f.call('manager/site/ai/service',{auth:'manager'});assert.equal(status.status,200);assert.deepEqual(status.body,{enabled:false,ready:false,state:'paused',model:null});
 const testResult=await f.call('manager/site/ai/test',{method:'POST',auth:'manager',data:{message:'Oi'}});assert.equal(testResult.status,503);assert.match(testResult.body.error,/desativado/);assert.equal(calls,0);
});
test('pause blocks new answers without erasing the chat, grants, name or personality and resume preserves them',async()=>{
 const f=await ready(),before=(await f.call(root+'/settings')).body;
 const saved=await f.call(root+'/settings',{method:'PUT',data:{revision:before.revision,config:{...before.settings,name:'Astra',instructions:'Fale de forma direta, como Astra.'}}});assert.equal(saved.status,200);
 const c=await chat(f),id=randomUUID();assert.equal((await toggle(f,false)).status,200);let calls=0;modelFetch(f,async(_url,o)=>{calls++;assert.match(JSON.parse(o.body).system,/Seu nome é Astra/);return Response.json({text:'{"text":"Meu nome é Astra.","action":null}'});});
 const denied=await send(f,c,id);assert.equal(denied.status,403);assert.match(denied.body.error,/pausada/);assert.equal(calls,0);assert.equal(f.tables.valtrex_assistant_chats[0].messages.length,0);
 const pref=(await f.call(root+'/settings')).body;assert.equal(pref.settings.name,'Astra');assert.equal(pref.settings.instructions,saved.body.settings.instructions);assert.equal(pref.access.paused,true);assert.equal(f.tables.valtrex_site_user_access[0].ai_enabled,true);
 assert.equal((await toggle(f,true)).status,200);const answer=await send(f,c,id);assert.equal(answer.status,200);assert.equal(answer.body.chat.messages.at(-1).content,'Meu nome é Astra.');assert.equal(calls,1);
});
test('a global pause during generation discards the answer and any proposed action',async()=>{
 const f=await ready(),c=await chat(f);modelFetch(f,async()=>{assert.equal((await toggle(f,false)).status,200);return Response.json({text:'{"text":"Não publicar.","action":{"kind":"theme","data":{"title":"Não aplicar"}}}'});});
 const result=await send(f,c);assert.equal(result.status,200);assert.equal(result.body.chat.messages.length,1);assert.match(result.body.notice,/pausada/);assert.equal(f.tables.valtrex_assistant_actions?.length||0,0);
});
