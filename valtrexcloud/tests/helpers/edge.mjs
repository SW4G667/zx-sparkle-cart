import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const hash=v=>createHash('sha256').update(v).digest('hex');
export const app='1500042139491635200',other='2500042139491635200',user='12345678901234567',second='22345678901234567',manager='1506929376967790752';
const bridge='bridge_0123456789012345678901234567890',cookie='c'.repeat(90),csrf='csrf-fixture';
export async function fixture(){
 let handle;let managerId=manager;
 const tables={valtrex_tenants:[{id:app,owner_user_id:user,bot_key_hash:hash(bridge)},{id:other,owner_user_id:second,bot_key_hash:hash('different')}],valtrex_portal_sessions:[],valtrex_product_catalogs:[],valtrex_product_commands:[],valtrex_site_notices:[],valtrex_notice_reads:[]};
 const digest=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('valtrexcloud-aes-v1\0test-role'));
 const key=await webcrypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt']);const iv=webcrypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(csrf));
 tables.valtrex_portal_sessions.push({session_hash:hash(cookie),discord_user_id:user,expires_at:'2099-01-01',csrf_cipher:`v1:${Buffer.from(iv).toString('base64')}:${Buffer.from(ciphertext).toString('base64')}`});
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='valtrex_support_send'?{id:1,threadId:'00000068-0000-4000-8000-000000000001'}:true,error:null};},from(table){
  const rows=tables[table]||(tables[table]=[]);const filters=[];let mutation=null,limit=Infinity,offset=0,order=null;
  const q={select(){return q;},in(k,values){filters.push(r=>values.includes(r[k]));return q;},range(a,b){offset=a;limit=b-a+1;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},lt(k,v){filters.push(r=>Number(r[k])<Number(v));return q;},is(k,v){filters.push(r=>r[k]===v);return q;},or(text){assert.equal(text,`target_user_id.is.null,target_user_id.eq.${user}`);filters.push(r=>!r.target_user_id||r.target_user_id===user);return q;},limit(n){limit=n;return q;},order(k,options){order=[k,options];return q;},insert(v){mutation=['insert',v];return q;},upsert(v){mutation=['upsert',v];return q;},update(v){mutation=['update',v];return q;},delete(){mutation=['delete'];return q;},
   async single(){const r=await run();return {...r,data:r.data?.[0]||null};},async maybeSingle(){return q.single();},then(ok,bad){return run().then(ok,bad);}};
  async function run(){if(mutation&&Array.isArray(mutation[1])){if(table==='valtrex_gifts'&&mutation[1].some(row=>rows.some(r=>r.id===row.id)))return {data:null,error:{code:'23505'}};for(const row of mutation[1]){const current=table==='valtrex_gifts'?null:rows.find(r=>r.tenant_id===row.tenant_id&&r.entry_id===row.entry_id);if(current)Object.assign(current,row);else rows.push({...row,uses:0,active:true,created_at:new Date().toISOString()});}return {data:mutation[1],error:null};}let matching=rows.filter(r=>filters.every(f=>f(r)));
   if(mutation){const[action,v]=mutation;
    if(action==='insert'||action==='upsert'){
      if(table==='valtrex_product_commands'&&rows.some(r=>r.tenant_id===v.tenant_id&&r.product_id===v.product_id&&r.state==='pending'))return {data:null,error:{code:'23505'}};
      let existing=action==='upsert'?rows.find(r=>table==='valtrex_product_catalogs'?r.tenant_id===v.tenant_id:r.notice_id===v.notice_id&&r.user_id===v.user_id):null;
      if(existing){Object.assign(existing,v);matching=[existing];}else{const row={id:webcrypto.randomUUID(),created_at:new Date().toISOString(),state:'pending',archived:false,...v};rows.push(row);matching=[row];}
    }else if(action==='update'){matching.forEach(r=>Object.assign(r,v));}
   }
   if(order)matching.sort((a,b)=>String(a[order[0]]).localeCompare(String(b[order[0]]))*(order[1]?.ascending===false?-1:1));
   return {data:structuredClone(matching.slice(offset,offset+limit)),count:matching.length,error:null};
  }return q;
 }};
 const source=readFileSync(new URL('../../supabase/functions/valtrex-cloud/index.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/u,'');
 vm.runInNewContext(transformSync(source,{loader:'ts',format:'iife',target:'es2022'}).code,{createClient:()=>db,Deno:{env:{get:n=>n==='SUPABASE_SERVICE_ROLE_KEY'?'test-role':null},serve:fn=>{handle=fn;}},fetch:async()=>Response.json({id:managerId,bot:true}),crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Response,Request,AbortSignal,Uint8Array,Date,Math,atob,btoa,console},{timeout:2000});
 async function call(path,{method='GET',data,auth='portal',headers={}}={}){
  const base='https://valtrexapplications.vercel.app';const h={'content-type':'application/json',origin:base,...(auth==='portal'?{cookie:`vtx_portal=${cookie}`,'x-valtrex-csrf':csrf}:auth==='bot'?{authorization:`Bearer ${bridge}`,'x-valtrex-application':app}:auth==='manager'?{authorization:`Bot ${'token_'.repeat(10)}`} : {}),...headers};
  const r=await handle(new Request(`${base}/${path}`,{method,headers:h,body:method==='GET'?undefined:JSON.stringify(data||{})}));return {status:r.status,body:await r.json()};
 }
 return {tables,call,calls,setManager:id=>{managerId=id;}};
}
