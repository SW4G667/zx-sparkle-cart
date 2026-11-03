import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,app,user} from './helpers/edge.mjs';
const root=`portal/apps/${app}/assistant`;
async function setup(){const f=await fixture();f.tables.valtrex_site_user_access=[{user_id:user,ai_managed:true,ai_enabled:true,ai_tickets:true,ai_community:true}];const chat=(await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat;return {f,chat};}
const send=(f,chat,text='Olá, pode me ajudar com minha loja?')=>f.call(`${root}/chats/${chat.id}/messages`,{method:'POST',data:{revision:chat.revision,clientId:randomUUID(),text,images:[]}});
test('Portuguese remains the default after an English reply in the conversation and preserves persona instructions',async()=>{
 const {f,chat}=await setup();let calls=0,sent;
 const prefs=(await f.call(root+'/settings')).body;
 await f.call(root+'/settings',{method:'PUT',data:{revision:prefs.revision,config:{...prefs.settings,name:'Luna',instructions:'You are a curious explorer. Preserve EXPLORER_105.'}}});
 f.setFetch(async(_u,o)=>{sent=JSON.parse(o.body);return Response.json({text:JSON.stringify({text:++calls===1?'Hello! How can I help you with your store?':'Sou a Luna. Posso ajudar com sua loja.',action:null})});});
 const previous=await send(f,chat,'Responda em inglês, por favor.');assert.equal(calls,1);
 const result=await send(f,previous.body.chat,'Agora responda em português. Como pode me ajudar?');assert.equal(result.status,200);assert.match(sent.system,/IDIOMA DA RESPOSTA: use português brasileiro/);assert.match(sent.system,/EXPLORER_105/);assert.match(sent.system,/Seu nome é Luna/);assert.ok(sent.system.length<=6000);assert.ok(sent.history.some(m=>m.role==='assistant'&&m.content.startsWith('Hello')));assert.match(result.body.chat.messages.at(-1).content,/Sou a Luna/);
});
test('an unwanted English answer is corrected once without changing a product proposal or executing it',async()=>{
 const {f,chat}=await setup();let calls=0;const bodies=[];
 f.setFetch(async(_u,o)=>{bodies.push(JSON.parse(o.body));return Response.json({text:++calls===1?JSON.stringify({text:'I can create your product. Do you want me to do that?',action:{kind:'product',data:{name:'Cloud Pass',description:'Plano mensal',delivery:'automatic',initialOption:{name:'30 dias',price:19.9}}}}):'Posso criar seu produto. Você deseja que eu prepare essa alteração?'});});
 const r=await send(f,chat);assert.equal(calls,2);assert.match(r.body.chat.messages.at(-1).content,/Posso criar seu produto/);assert.equal(r.body.chat.actions[0].payload.name,'Cloud Pass');assert.equal(r.body.chat.actions[0].state,'pending');assert.equal(f.tables.valtrex_product_commands.length,0);assert.notEqual(bodies[0].requestId,bodies[1].requestId);assert.deepEqual(bodies[1].history,[]);
});
test('a negated request for English still requires Portuguese',async()=>{
 const {f,chat}=await setup();let calls=0;f.setFetch(async()=>Response.json({text:++calls===1?'Hello! How can I help you with your store?':'Olá! Posso ajudar com sua loja.'}));
 const r=await send(f,chat,'Não responda em inglês. Pode me ajudar?');assert.equal(calls,2);assert.match(r.body.chat.messages.at(-1).content,/Olá/);
});
test('an English answer wrapped in quotation marks is still corrected',async()=>{
 const {f,chat}=await setup();let calls=0;f.setFetch(async()=>Response.json({text:JSON.stringify({text:++calls===1?'"Hello! How can I help you?"':'Olá! Como posso ajudar?',action:null})}));const r=await send(f,chat);assert.equal(calls,2);assert.match(r.body.chat.messages.at(-1).content,/Olá/);
});
test('explicit translation requests may contain English and Portuguese technical replies need no second call',async()=>{
 const {f,chat}=await setup();let calls=0;f.setFetch(async()=>Response.json({text:JSON.stringify({text:++calls===1?'Hello! How can I help you?':'O produto Cloud Pass usa o campo `productId`.',action:null})}));
 const translated=await send(f,chat,'Traduza uma saudação para inglês.');assert.equal(calls,1);assert.match(translated.body.chat.messages.at(-1).content,/Hello/);
 const portuguese=await send(f,translated.body.chat,'Agora explica esse produto em português.');assert.equal(calls,2);assert.match(portuguese.body.chat.messages.at(-1).content,/productId/);
});
test('failed correction never stores the English answer or loops through more generations',async()=>{
 const {f,chat}=await setup();let calls=0;f.setFetch(async()=>{calls++;return Response.json({text:'Hello! How can I help you with your store?'});});
 const r=await send(f,chat);assert.equal(calls,2);assert.match(r.body.notice,/português/);assert.equal(r.body.chat.messages.length,1);assert.equal((f.tables.valtrex_assistant_actions||[]).length,0);
});
test('permission revocation during language correction discards the reply and proposals',async()=>{
 const {f,chat}=await setup();let calls=0;f.setFetch(async()=>{calls++;if(calls===2)f.tables.valtrex_site_user_access[0].ai_enabled=false;return Response.json({text:calls===1?'Hello! How can I help you with your store?':'Olá! Posso ajudar com sua loja.'});});
 const r=await send(f,chat);assert.equal(calls,2);assert.ok(r.body.notice);assert.equal(r.body.chat.messages.length,1);assert.equal((f.tables.valtrex_assistant_actions||[]).length,0);
});
