import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,app,other,user} from './helpers/edge.mjs';
const root=`portal/apps/${app}/assistant`;
async function ready(){const f=await fixture();f.tables.valtrex_site_user_access=[{user_id:user,ai_managed:true,ai_enabled:true,ai_tickets:true,ai_community:true}];return f;}
async function chat(f){return (await f.call(root,{method:'POST',data:{id:randomUUID()}})).body.chat;}
async function say(f,c){return f.call(`${root}/chats/${c.id}/messages`,{method:'POST',data:{revision:c.revision,clientId:randomUUID(),text:'Qual é seu nome e como você conversa?',images:[]}});}
async function preferences(f){return (await f.call(root+'/settings')).body;}
async function save(f,current,changes){return f.call(root+'/settings',{method:'PUT',data:{revision:current.revision,config:{...current.settings,...changes}}});}
test('a saved assistant name and the complete personal prompt survive reload and reach inference',async()=>{
 const f=await ready(),before=await preferences(f),prompt='Você é Luna e fala com humor. '+'.'.repeat(2650)+' Preserve esta instrução no fim: FINAL_PERSONA_100.';
 const result=await save(f,before,{name:'Luna',tone:'custom',instructions:prompt});assert.equal(result.status,200);assert.equal(result.body.displayName,'Luna');
 const reload=await preferences(f);assert.equal(reload.settings.name,'Luna');assert.equal(reload.settings.instructions,prompt);
 let sent;f.setFetch(async(_u,o)=>{sent=JSON.parse(o.body);return Response.json({text:'{"text":"Sou a Luna.","action":null}'});});
 assert.equal((await say(f,await chat(f))).status,200);assert.match(sent.system,/Seu nome é Luna/);assert.match(sent.system,/FINAL_PERSONA_100/);assert.doesNotMatch(sent.system,/Você é CLOUD AI,/);
});
test('user-created personalities can be selected, edited and removed without reusing the previous identity',async()=>{
 const f=await ready(),before=await preferences(f),a=randomUUID(),b=randomUUID();
 const personas=[{id:a,title:'Minha Luna',name:'Luna',tone:'custom',instructions:'PERSONA_LUNA_100'},{id:b,title:'Meu Atlas',name:'Atlas',tone:'professional',instructions:'PERSONA_ATLAS_100'}];
 const first=await save(f,before,{personas,activePersonaId:a});assert.equal(first.status,200);
 let sent;f.setFetch(async(_u,o)=>{sent=JSON.parse(o.body);return Response.json({text:'{"text":"Resposta.","action":null}'});});
 await say(f,await chat(f));assert.match(sent.system,/PERSONA_LUNA_100/);assert.doesNotMatch(sent.system,/PERSONA_ATLAS_100/);
 const switched=await save(f,first.body,{activePersonaId:b});assert.equal(switched.status,200);assert.equal(switched.body.displayName,'Atlas');
 await say(f,await chat(f));assert.match(sent.system,/Seu nome é Atlas/);assert.match(sent.system,/PERSONA_ATLAS_100/);assert.doesNotMatch(sent.system,/PERSONA_LUNA_100/);
 const deleted=await save(f,switched.body,{activePersonaId:'',personas:[personas[0]]});assert.equal(deleted.status,200);assert.equal((await preferences(f)).settings.personas.length,1);
});
test('the application prompt and configured name also apply to the private assistant when there is no personal override',async()=>{
 const f=await ready();f.tables.valtrex_workspace_config=[{tenant_id:app,ai:{systemPrompt:'GENERAL_PERSONA_100: fale como uma exploradora.',knowledge:'Conhecimento da loja.',cloud:{name:'Astra'}}}];
 const initial=await preferences(f);assert.equal(initial.displayName,'Astra');let sent;
 f.setFetch(async(_u,o)=>{sent=JSON.parse(o.body);return Response.json({text:'{"text":"Sou Astra.","action":null}'});});await say(f,await chat(f));assert.match(sent.system,/GENERAL_PERSONA_100/);assert.match(sent.system,/Seu nome é Astra/);
});
test('duplicate identities, nonexistent active personas and concurrent writes are rejected without changing saved preferences',async()=>{
 const f=await ready(),current=await preferences(f),id=randomUUID(),p={id,title:'Minha personalidade',name:'Luna',instructions:'Meu prompt',tone:'custom'};
 assert.equal((await save(f,current,{personas:[p,p]})).status,400);assert.equal((await save(f,current,{activePersonaId:randomUUID()})).status,400);
 const saved=await save(f,current,{name:'Primeira'});assert.equal(saved.status,200);assert.equal((await save(f,current,{name:'Sobrescrever'})).status,409);assert.equal((await preferences(f)).settings.name,'Primeira');
 assert.equal((await f.call(`portal/apps/${other}/assistant/settings`)).status,404);
});
test('the server-conversation preview uses that prompt and the configured assistant name',async()=>{
 const f=await ready(),workspace=(await f.call(`portal/apps/${app}/workspace`)).body;
 const cloud={...workspace.cloudAI,enabled:true,name:'Astra',ticketPrompt:'TICKET_PERSONA_100',communityPrompt:'COMMUNITY_PERSONA_100'};
 f.tables.valtrex_workspace_config=[{tenant_id:app,revision:randomUUID(),ai:{...workspace.ai,cloud}}];let sent;
 f.setFetch(async(_u,o)=>{sent=JSON.parse(o.body);return Response.json({text:'Sou Astra.'});});
 const r=await f.call(`portal/apps/${app}/workspace/cloud-ai/test`,{method:'POST',data:{message:'Qual seu nome?',history:[],previewPurpose:'community'}});
 assert.equal(r.status,200);assert.match(sent.system,/COMMUNITY_PERSONA_100/);assert.doesNotMatch(sent.system,/TICKET_PERSONA_100/);assert.match(sent.system,/NOME CONFIGURADO PELO RESPONSÁVEL: Astra/);
});
