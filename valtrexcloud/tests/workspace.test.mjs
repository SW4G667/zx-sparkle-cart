import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const hash=v=>createHash('sha256').update(v).digest('hex');
const app='1500042139491635200',other='2500042139491635200',user='12345678901234567',second='22345678901234567',manager='1506929376967790752';
const bridge='bridge_0123456789012345678901234567890',cookie='c'.repeat(90),csrf='csrf-fixture';
async function fixture(){
 let handle;let managerId=manager;
 const tables={valtrex_tenants:[{id:app,owner_user_id:user,bot_key_hash:hash(bridge)},{id:other,owner_user_id:second,bot_key_hash:hash('different')}],valtrex_portal_sessions:[],valtrex_product_catalogs:[],valtrex_product_commands:[],valtrex_site_notices:[],valtrex_notice_reads:[]};
 const digest=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('valtrexcloud-aes-v1\0test-role'));
 const key=await webcrypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt']);const iv=webcrypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(csrf));
 tables.valtrex_portal_sessions.push({session_hash:hash(cookie),discord_user_id:user,expires_at:'2099-01-01',csrf_cipher:`v1:${Buffer.from(iv).toString('base64')}:${Buffer.from(ciphertext).toString('base64')}`});
 const db={rpc:async()=>({data:true,error:null}),from(table){
  const rows=tables[table]||(tables[table]=[]);const filters=[];let mutation=null,limit=Infinity,order=null;
  const q={select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},is(k,v){filters.push(r=>r[k]===v);return q;},or(text){assert.equal(text,`target_user_id.is.null,target_user_id.eq.${user}`);filters.push(r=>!r.target_user_id||r.target_user_id===user);return q;},limit(n){limit=n;return q;},order(k,options){order=[k,options];return q;},insert(v){mutation=['insert',v];return q;},upsert(v){mutation=['upsert',v];return q;},update(v){mutation=['update',v];return q;},delete(){mutation=['delete'];return q;},
   async single(){const r=await run();return {...r,data:r.data?.[0]||null};},async maybeSingle(){return q.single();},then(ok,bad){return run().then(ok,bad);}};
  async function run(){let matching=rows.filter(r=>filters.every(f=>f(r)));
   if(mutation){const[action,v]=mutation;
    if(action==='insert'||action==='upsert'){
      if(table==='valtrex_product_commands'&&rows.some(r=>r.tenant_id===v.tenant_id&&r.product_id===v.product_id&&r.state==='pending'))return {data:null,error:{code:'23505'}};
      let existing=action==='upsert'?rows.find(r=>table==='valtrex_product_catalogs'?r.tenant_id===v.tenant_id:r.notice_id===v.notice_id&&r.user_id===v.user_id):null;
      if(existing){Object.assign(existing,v);matching=[existing];}else{const row={id:webcrypto.randomUUID(),created_at:new Date().toISOString(),state:'pending',archived:false,...v};rows.push(row);matching=[row];}
    }else if(action==='update'){matching.forEach(r=>Object.assign(r,v));}
   }
   if(order)matching.sort((a,b)=>String(a[order[0]]).localeCompare(String(b[order[0]]))*(order[1]?.ascending===false?-1:1));
   return {data:structuredClone(matching.slice(0,limit)),error:null};
  }return q;
 }};
 const source=readFileSync(new URL('../supabase/functions/valtrex-cloud/index.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/u,'');
 vm.runInNewContext(transformSync(source,{loader:'ts',format:'iife',target:'es2022'}).code,{createClient:()=>db,Deno:{env:{get:n=>n==='SUPABASE_SERVICE_ROLE_KEY'?'test-role':null},serve:fn=>{handle=fn;}},fetch:async()=>Response.json({id:managerId,bot:true}),crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Response,Request,AbortSignal,Uint8Array,Date,Math,atob,btoa,console},{timeout:2000});
 async function call(path,{method='GET',data,auth='portal',headers={}}={}){
  const base='https://valtrexapplications.vercel.app';const h={'content-type':'application/json',origin:base,...(auth==='portal'?{cookie:`vtx_portal=${cookie}`,'x-valtrex-csrf':csrf}:auth==='bot'?{authorization:`Bearer ${bridge}`,'x-valtrex-application':app}:auth==='manager'?{authorization:`Bot ${'token_'.repeat(10)}`} : {}),...headers};
  const r=await handle(new Request(`${base}/${path}`,{method,headers:h,body:method==='GET'?undefined:JSON.stringify(data||{})}));return {status:r.status,body:await r.json()};
 }
 return {tables,call,setManager:id=>{managerId=id;}};
}
const valid={name:'Produto web',description:'Uma descrição',delivery:'manual'};
test('catalog requires a session and never exposes another owner',async()=>{const f=await fixture();assert.equal((await f.call(`portal/apps/${app}/products`,{auth:'none'})).status,401);assert.equal((await f.call(`portal/apps/${other}/products`)).status,404);assert.equal((await f.call(`portal/apps/${app}/products`)).status,200);});
test('product mutations require same-origin CSRF and valid input',async()=>{const f=await fixture();for(const headers of [{'x-valtrex-csrf':'wrong'},{origin:'https://attacker.example'}])assert.equal((await f.call(`portal/apps/${app}/products`,{method:'POST',data:valid,headers})).status,403);assert.equal((await f.call(`portal/apps/${app}/products`,{method:'POST',data:{...valid,name:''}})).status,400);});
test('creation is pending until the matching authenticated bot acknowledges it',async()=>{const f=await fixture();const result=await f.call(`portal/apps/${app}/products`,{method:'POST',data:valid});assert.equal(result.status,202);assert.equal(result.body.pending,true);const command=f.tables.valtrex_product_commands[0];assert.equal(command.state,'pending');assert.match(command.product_id,/^cloud_[a-f0-9]{32}$/);assert.equal((await f.call('bot/products',{auth:'none'})).status,401);const queue=await f.call('bot/products',{auth:'bot'});assert.equal(queue.body.commands[0].id,command.id);assert.equal((await f.call('bot/products/result',{auth:'bot',method:'POST',data:{id:command.id,state:'applied'}})).status,200);assert.equal(command.state,'applied');assert.equal((await f.call('bot/products',{auth:'bot'})).body.commands.length,0);});
test('snapshot strips stock, arbitrary properties and customer information',async()=>{const f=await fixture();const snapshot={...valid,id:'p1',revision:'a'.repeat(64),options:2,stock:['private-key'],token:'secret',purchases:['customer']};assert.equal((await f.call('bot/products/snapshot',{auth:'bot',method:'POST',data:{products:[snapshot]}})).status,200);const {body}=await f.call(`portal/apps/${app}/products`);assert.equal(body.products.length,1);assert.equal(body.products[0].stock,undefined);assert.equal(body.products[0].token,undefined);assert.equal(body.products[0].purchases,undefined);assert.equal(body.bridgeVersion,1);});
test('stale revisions and duplicate pending changes are rejected',async()=>{const f=await fixture();f.tables.valtrex_product_catalogs.push({tenant_id:app,products:[{...valid,id:'p1',revision:'a'.repeat(64)}]});assert.equal((await f.call(`portal/apps/${app}/products`,{method:'POST',data:{...valid,productId:'p1',baseRevision:'old'}})).status,409);for(const expected of [202,409])assert.equal((await f.call(`portal/apps/${app}/products`,{method:'POST',data:{...valid,productId:'p1',baseRevision:'a'.repeat(64)}})).status,expected);});
test('a bot cannot acknowledge another tenant command and acknowledgement is idempotent',async()=>{const f=await fixture();const row={id:webcrypto.randomUUID(),tenant_id:other,state:'pending'};f.tables.valtrex_product_commands.push(row);for(let n=0;n<2;n++)await f.call('bot/products/result',{auth:'bot',method:'POST',data:{id:row.id,state:'applied'}});assert.equal(row.state,'pending');});
test('only the configured Discord Manager can publish notices',async()=>{const f=await fixture();assert.equal((await f.call('manager/site/notifications',{auth:'none',method:'POST'})).status,401);f.setManager(other);assert.equal((await f.call('manager/site/notifications',{auth:'manager',method:'POST',data:{title:'Novidade',message:'Teste',days:30}})).status,403);f.setManager(manager);const result=await f.call('manager/site/notifications',{auth:'manager',method:'POST',data:{title:'Novidade',message:'Teste',days:30}});assert.equal(result.status,201);});
test('notices are scoped, expire, archive and can be marked read',async()=>{const f=await fixture();const own={id:webcrypto.randomUUID(),title:'Aviso',message:'Olá',archived:false,expires_at:'2099-01-01',target_user_id:user};const hidden={...own,id:webcrypto.randomUUID(),target_user_id:second};f.tables.valtrex_site_notices.push(own,hidden,{...own,id:webcrypto.randomUUID(),archived:true},{...own,id:webcrypto.randomUUID(),expires_at:'2020-01-01'});const result=await f.call('portal/notifications');assert.equal(result.body.notifications.length,1);assert.equal(result.body.notifications[0].read,false);assert.equal((await f.call(`portal/notifications/${hidden.id}/read`,{method:'POST'})).status,404);assert.equal((await f.call(`portal/notifications/${own.id}/read`,{method:'POST'})).status,200);assert.equal((await f.call('portal/notifications')).body.notifications[0].read,true);});
test('loading options are bounded and credentials are not returned',async()=>{const f=await fixture();await f.call(`portal/apps/${app}/config`,{method:'PUT',data:{theme:{loadingTransparent:true,loadingSpeed:100,loadingOverlay:95,loadingPosition:'top'}}});const r=await f.call(`portal/apps/${app}/config`);assert.equal(r.body.theme.loadingSpeed,12);assert.equal(r.body.theme.loadingOverlay,90);assert.equal(r.body.theme.loadingPosition,'top');assert.equal(r.body.theme.loadingTransparent,true);assert.equal(r.body.client_secret_cipher,undefined);});
