import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,app,other,user} from './helpers/edge.mjs';
const root=`portal/apps/${app}/assistant`,png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPa8AAAAASUVORK5CYII=';
async function setup(){const f=await fixture(),w=(await f.call(`portal/apps/${app}/workspace`)).body;
 const configured=await f.call(`portal/apps/${app}/workspace`,{method:'PUT',data:{revision:w.revision,ai:{...w.ai,enabled:true,provider:'xai',systemPrompt:'Seu nome é Lyze.',models:{...w.ai.models,xai:'grok-4.7'}},keys:{xai:'test-key-fixture-never-real'}}});assert.equal(configured.status,200);
 let chat=(await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat;f.setFetch(async()=>Response.json({choices:[{message:{content:JSON.stringify({text:'Sou Lyze. Como posso ajudar?',action:null})}}]}));
 return {f,chat};}
async function send(f,chat,extra={}){return f.call(`${root}/chats/${chat.id}/messages`,{method:'POST',data:{text:'Olá',images:[],revision:chat.revision,clientId:randomUUID(),...extra}});}
test('private history persists real roles, configured persona and separate chats; anonymous and other owners cannot read',async()=>{
 const {f,chat}=await setup();let payload;f.setFetch(async(_url,o)=>{payload=JSON.parse(o.body);return Response.json({choices:[{message:{content:'{"text":"Sou Lyze.","action":null}'}}]});});
 const r=await send(f,chat);assert.equal(r.status,200);assert.equal(r.body.chat.messages.length,2);assert.match(payload.messages[0].content,/Seu nome é Lyze/);assert.equal(payload.messages.at(-1).role,'user');
 assert.equal((await f.call(`${root}/chats/${chat.id}`,{auth:'none'})).status,401);assert.equal((await f.call(`portal/apps/${other}/assistant/chats/${chat.id}`)).status,404);
 assert.equal((await f.call(root)).body.chats.length,1);assert.equal((await f.call(`${root}/chats/${randomUUID()}`)).status,404);
 const second=(await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat;assert.equal(second.messages.length,0);
});
test('model proposal never executes before Yes; No cancels and cannot be replayed as Yes',async()=>{
 const {f,chat}=await setup();f.setFetch(async()=>Response.json({choices:[{message:{content:JSON.stringify({text:'Posso criar este produto?',action:{kind:'product',data:{name:'Mensal',description:'Plano mensal',delivery:'automatic',initialOption:{name:'30 dias',price:19.9}}}})}}]}));
 const r=await send(f,chat),a=r.body.chat.actions[0];assert.ok(a);assert.equal(f.tables.valtrex_product_commands.length,0);
 const denied=await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:false}});assert.equal(denied.body.state,'cancelled');
 const replay=await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:true}});assert.equal(replay.body.state,'cancelled');assert.equal(f.tables.valtrex_product_commands.length,0);
});
test('Yes executes immutable validated payload once, ignores client payload replacement, and checks CSRF',async()=>{
 const {f,chat}=await setup();f.tables.valtrex_product_catalogs=[{tenant_id:app,bridge_version:2,products:[]}];
 f.setFetch(async()=>Response.json({choices:[{message:{content:JSON.stringify({text:'Criar produto?',action:{kind:'product',data:{name:'Mensal',description:'Plano mensal',delivery:'automatic',initialOption:{name:'30 dias',price:19.9}}}})}}]}));
 const r=await send(f,chat),a=r.body.chat.actions[0];assert.ok(a);
 assert.equal((await f.call(`${root}/actions/${a.id}`,{method:'POST',headers:{'x-valtrex-csrf':'wrong'},data:{approve:true}})).status,403);
 const yes=await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:true,payload:{name:'Injected'}}});assert.equal(yes.body.state,'done',JSON.stringify(yes.body));
 await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:true}});assert.equal(f.tables.valtrex_product_commands.length,1);assert.equal(f.tables.valtrex_product_commands[0].payload.name,'Mensal');assert.equal(f.tables.valtrex_product_commands[0].id,a.id);
});
test('editing a user message prunes later replies and cancels pending proposals; stale revisions are rejected',async()=>{
 const {f,chat}=await setup();f.setFetch(async()=>Response.json({choices:[{message:{content:'{"text":"Alterar?","action":{"kind":"restock","data":{"useImage":true}}}'}}]}));
 const r=(await send(f,chat)).body.chat;assert.equal(r.actions.length,1);
 assert.equal((await send(f,chat)).status,409);
 const edited=await send(f,r,{text:'Prefiro texto sem imagem',editId:r.messages[0].id});assert.equal(edited.status,200);assert.equal(edited.body.chat.messages.length,2);assert.equal(edited.body.chat.messages[0].content,'Prefiro texto sem imagem');assert.equal(f.tables.valtrex_assistant_actions[0].state,'cancelled');
});
test('gallery images are private, at most five per message, and cannot reference another conversation',async()=>{
 const {f,chat}=await setup();const uploaded=await f.call(`${root}/chats/${chat.id}/media`,{method:'POST',data:{dataUrl:png}});assert.equal(uploaded.status,201);assert.match(uploaded.body.url,/object\/sign\/assistant-private95/);assert.ok(uploaded.body.path.startsWith(`${app}/${user}/${chat.id}/`));
 assert.equal((await send(f,chat,{images:Array(6).fill(uploaded.body.path)})).status,400);
 assert.equal((await send(f,chat,{images:[uploaded.body.path.replace(chat.id,randomUUID())]})).status,400);
 assert.equal((await f.call(`${root}/chats/${chat.id}/media`,{method:'POST',data:{dataUrl:'data:image/svg+xml;base64,PHN2Zy8+'}})).status,400);
 const r=await send(f,chat,{images:[uploaded.body.path]});assert.equal(r.body.chat.messages[0].images.length,1);
 assert.equal((await f.call(`${root}/chats/${chat.id}`,{method:'DELETE'})).status,200);assert.equal(f.media.size,0);
});
test('image editing requires consent, uses JSON xAI contract, and stores a private generated result',async()=>{
 const {f,chat}=await setup();const image=(await f.call(`${root}/chats/${chat.id}/media`,{method:'POST',data:{dataUrl:png}})).body;
 let edits=0;f.setFetch(async(url,o)=>{if(String(url).endsWith('/images/edits')){edits++;const p=JSON.parse(o.body);assert.equal(p.model,'grok-imagine-image-2.0');assert.equal(p.image.type,'image_url');return Response.json({data:[{b64_json:png.split(',')[1]}]});}return Response.json({choices:[{message:{content:'{"text":"Editar?","action":{"kind":"image_edit","data":{"prompt":"Mude para preto e branco"}}}'}}]});});
 const proposed=(await send(f,chat,{images:[image.path]})).body.chat;assert.equal(edits,0);const a=proposed.actions[0];assert.ok(a);
 const yes=await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:true}});assert.equal(yes.body.state,'done',JSON.stringify(yes.body));assert.equal(edits,1);
 const current=(await f.call(`${root}/chats/${chat.id}`)).body.chat;assert.match(current.messages.at(-1).content,/Imagem editada/);assert.ok(current.messages.at(-1).images[0].url.includes('object/sign'));
});
test('unavailable provider preserves user message and repeated request does not call model twice',async()=>{
 const {f,chat}=await setup();let calls=0;f.setFetch(async()=>{calls++;throw new TypeError('network');});const clientId=randomUUID(),r=await send(f,chat,{clientId});assert.equal(r.status,200);assert.ok(r.body.notice);assert.equal(r.body.chat.messages.length,1);
 const again=await send(f,r.body.chat,{clientId});assert.equal(again.body.repeated,true);assert.equal(calls,1);
});
test('confirmed theme proposal changes verification and a stale proposal cannot overwrite a newer page',async()=>{
 const {f,chat}=await setup();f.tables.valtrex_tenants[0].updated_at='2026-01-01';
 f.setFetch(async()=>Response.json({choices:[{message:{content:'{"text":"Aplicar as cores?","action":{"kind":"theme","data":{"primary":"#eeeeee","background":"#111111","title":"Verifique sua conta"}}}'}}]}));
 const first=(await send(f,chat)).body.chat,a=first.actions[0];assert.ok(a);assert.equal(f.tables.valtrex_tenants[0].theme,undefined);
 const yes=await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:true}});assert.equal(yes.body.state,'done');assert.equal(f.tables.valtrex_tenants[0].theme.primary,'#eeeeee');
 const secondChat=(await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat,second=(await send(f,secondChat)).body.chat;
 f.tables.valtrex_tenants[0].theme.primary='#ffffff';
 const stale=await f.call(`${root}/actions/${second.actions[0].id}`,{method:'POST',data:{approve:true}});assert.equal(stale.body.state,'failed');assert.equal(f.tables.valtrex_tenants[0].theme.primary,'#ffffff');
});
test('confirmed restock proposal saves validated palette and layout through the versioned operation RPC',async()=>{
 const {f,chat}=await setup();f.setFetch(async()=>Response.json({choices:[{message:{content:'{"text":"Aplicar?","action":{"kind":"restock","data":{"useImage":true,"appearance":{"accent":"#ffffff","buttonStyle":3,"elements":{"stock":{"x":0,"y":0,"scale":1.2}}}}}}'}}]}));
 const first=(await send(f,chat)).body.chat,a=first.actions[0];assert.ok(a);const yes=await f.call(`${root}/actions/${a.id}`,{method:'POST',data:{approve:true}});assert.equal(yes.body.state,'done',JSON.stringify(yes.body));
 assert.equal(f.tables.valtrex_operation_config[0].config.restock.appearance.buttonStyle,3);assert.equal(f.tables.valtrex_operation_config[0].config.restock.appearance.elements.stock.scale,1.2);
});
