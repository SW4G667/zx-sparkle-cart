import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,app,other,user} from './helpers/edge.mjs';
const root=`portal/apps/${app}/assistant`;
test('the administrator can switch the signed hosted runtime without a customer API key',async()=>{
 const f=await fixture({env:{CLOUD_AI_ENDPOINT:'https://cloud-ai96.example.org/cloud-support/api/cloud-ai/generate'}});
 f.tables.valtrex_site_user_access=[{user_id:user,ai_managed:true,ai_enabled:true,ai_tickets:true,ai_community:true}];
 let target;f.setFetch(async(url,options)=>{target=String(url);assert.ok(options.headers['x-cloud-permit']);assert.equal(options.headers.Authorization,undefined);return Response.json({text:'{"text":"Novo modelo.","action":null}',model:'HauhauCS/Qwen3.8-27B'});});
 const c=await chat(f),r=await send(f,c,'Oi');assert.equal(r.status,200);assert.equal(target,'https://cloud-ai96.example.org/cloud-support/api/cloud-ai/generate');
});
async function ready(){const f=await fixture();f.tables.valtrex_site_user_access=[{user_id:user,ai_managed:true,ai_enabled:true,ai_tickets:true,ai_community:true}];f.setFetch(async()=>Response.json({text:'{"text":"Olá! Vamos conversar.","action":null}',model:'Qwen'}));return f;}
async function chat(f){return (await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat;}
async function send(f,c,text){return f.call(`${root}/chats/${c.id}/messages`,{method:'POST',data:{clientId:randomUUID(),revision:c.revision,text,images:[]}});}
test('CLOUD AI uses only the existing signed Hugging Face endpoint with no user keys and Manager controlled access',async()=>{
 const f=await ready(),c=await chat(f);let request;f.setFetch(async(url,options)=>{request={url,options};return Response.json({text:'{"text":"Sou CLOUD AI.","action":null}'});});
 const r=await send(f,c,'Qual é seu nome?');assert.equal(r.status,200);assert.equal(r.body.chat.messages.at(-1).content,'Sou CLOUD AI.');assert.match(request.url,/china12n-007-ai-agent-runtime\.hf\.space\/cloud-support/);assert.ok(request.options.headers['x-cloud-permit']);assert.equal(request.options.headers.Authorization,undefined);assert.equal(f.tables.valtrex_workspace_config?.length||0,0);
 f.tables.valtrex_site_user_access[0].ai_enabled=false;const blocked=await send(f,r.body.chat,'Oi');assert.equal(blocked.status,403);assert.match(blocked.body.error,/Manager/);
});
test('avatar and personality persist privately, validate stale updates and never accept API settings',async()=>{
 const f=await ready(),initial=(await f.call(root+'/settings')).body;
 const saved=await f.call(root+'/settings',{method:'PUT',data:{revision:initial.revision,config:{...initial.settings,avatar:'moon',tone:'creative',instructions:'Use uma linguagem leve e exemplos simples.'}}});assert.equal(saved.status,200);assert.equal(saved.body.settings.avatar,'moon');assert.equal(saved.body.name,'CLOUD AI');assert.equal(saved.body.provider,'huggingface');
 assert.equal((await f.call(root+'/settings',{method:'PUT',data:{revision:null,config:initial.settings}})).status,409);
 assert.equal((await f.call(`portal/apps/${other}/assistant/settings`)).status,404);
 assert.equal((await f.call(root+'/settings',{method:'PUT',data:{revision:saved.body.revision,config:{...saved.body.settings,apiKey:'invalid-secret'}}})).status,400);
 const c=await chat(f);let system;f.setFetch(async(_u,o)=>{system=JSON.parse(o.body).system;return Response.json({text:'{"text":"Vamos criar!","action":null}'});});await send(f,c,'Oi!');assert.match(system,/linguagem leve/);assert.match(system,/criativa/);
});
test('automatic preference learning carries to a new chat, is editable/resettable and stops when disabled',async()=>{
 const f=await ready(),a=await chat(f);await send(f,a,'Meu nome é Leo. Prefiro respostas curtas. Minha cor favorita é azul.');
 let preferences=(await f.call(root+'/settings')).body;assert.equal(preferences.memories.length,3);assert.ok(preferences.memories.some(m=>m.key==='preferred_name'&&m.value==='Leo'));
 let payload;f.setFetch(async(_u,o)=>{payload=JSON.parse(o.body);return Response.json({text:'{"text":"Oi, Leo.","action":null}'});});await send(f,await chat(f),'Você lembra de mim?');assert.match(payload.system,/Leo/);assert.match(payload.system,/curtas/);
 const reset=await f.call(root+'/settings/memory',{method:'PUT',data:{revision:preferences.revision,memories:[]}});assert.equal(reset.status,200);assert.equal(reset.body.memories.length,0);
 const disabled=await f.call(root+'/settings',{method:'PUT',data:{revision:reset.body.revision,config:{...reset.body.settings,memoryEnabled:false}}});assert.equal(disabled.status,200);
 await send(f,await chat(f),'Me chame de Ana.');assert.equal((await f.call(root+'/settings')).body.memories.length,0);
});
test('passwords and credential instructions are not saved as preferences and deleting a source chat forgets its memories',async()=>{
 const f=await ready(),c=await chat(f);await send(f,c,'Meu nome é token private-secret.');assert.equal((await f.call(root+'/settings')).body.memories.length,0);
 const next=await chat(f);await send(f,next,'Me chame de Lara.');assert.equal((await f.call(root+'/settings')).body.memories.length,1);
 await f.call(`${root}/chats/${next.id}`,{method:'DELETE'});assert.equal((await f.call(root+'/settings')).body.memories.length,0);
});
test('revoking Manager access during inference discards the generated answer',async()=>{
 const f=await ready(),c=await chat(f);f.setFetch(async()=>{f.tables.valtrex_site_user_access[0].ai_enabled=false;return Response.json({text:'{"text":"Resposta proibida.","action":null}'});});
 const r=await send(f,c,'Oi');assert.equal(r.status,200);assert.equal(r.body.chat.messages.length,1);assert.match(r.body.notice,/Manager/);
});
test('granular receipt positions, fonts and text styles survive API save while payment data cannot be replaced',async()=>{
 const f=await ready(),elements={buyerName:{x:350,y:240,scale:1.5,fontSize:48,font:'serif',color:'#ffccaa',rotation:15,align:'center',letterSpacing:2,bold:true},totalValue:{x:-200,y:100,scale:.8,color:'#eeeeee'},title:{x:0,y:0,scale:1,text:'Pedido aprovado'}};
 const r=await f.call(`portal/apps/${app}/operations/studio`,{method:'PUT',data:{revision:null,config:{receipt:{elements}}}});assert.equal(r.status,200);assert.equal(r.body.config.receipt.elements.buyerName.x,350);assert.equal(r.body.config.receipt.elements.buyerName.fontSize,48);assert.equal(r.body.config.receipt.elements.buyerName.rotation,15);
 const invalid=await f.call(`portal/apps/${app}/operations/studio`,{method:'PUT',data:{revision:r.body.revision,config:{receipt:{elements:{totalValue:{x:0,y:0,scale:1,text:'R$ 999,00'}}}}}});assert.equal(invalid.status,400);
});
