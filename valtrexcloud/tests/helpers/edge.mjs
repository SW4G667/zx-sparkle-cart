import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
const hash=v=>createHash('sha256').update(v).digest('hex');
export const app='1500042139491635200',other='2500042139491635200',user='12345678901234567',second='22345678901234567',manager='1506929376967790752';
const bridge='bridge_0123456789012345678901234567890',cookie='c'.repeat(90),csrf='csrf-fixture';
export async function fixture(){
 let externalFetch=null;const networkCalls=[];
 let handle;let managerId=manager;
 const tables={valtrex_tenants:[{id:app,owner_user_id:user,bot_key_hash:hash(bridge)},{id:other,owner_user_id:second,bot_key_hash:hash('different')}],valtrex_portal_sessions:[],valtrex_product_catalogs:[],valtrex_product_commands:[],valtrex_site_notices:[],valtrex_notice_reads:[]};
 const digest=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('valtrexcloud-aes-v1\0test-role'));
 const key=await webcrypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt']);const iv=webcrypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(csrf));
 tables.valtrex_portal_sessions.push({session_hash:hash(cookie),discord_user_id:user,expires_at:'2099-01-01',csrf_cipher:`v1:${Buffer.from(iv).toString('base64')}:${Buffer.from(ciphertext).toString('base64')}`});
 const primary=(table,r)=> table==='valtrex_site_user_access'?[r.user_id]:table==='valtrex_ticket_threads'?[r.tenant_id,r.channel_id]:table==='valtrex_ticket_messages'?[r.tenant_id,r.channel_id,r.message_id]:['valtrex_workspace_config','valtrex_workspace_state','valtrex_product_catalogs','valtrex_ai_access'].includes(table)?[r.tenant_id]:table==='valtrex_finance_entries'?[r.tenant_id,r.entry_id]:table==='valtrex_notice_reads'?[r.notice_id,r.user_id]:[r.id];
 const same=(table,a,b)=>JSON.stringify(primary(table,a))===JSON.stringify(primary(table,b));
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});if(name==='valtrex_claim_manager_commands'){const rows=tables.valtrex_manager_commands||[];const jobs=rows.filter(r=>r.state==='pending').slice(0,3);for(const r of jobs)Object.assign(r,{state:'processing',lease:webcrypto.randomUUID()});return {data:structuredClone(jobs),error:null};}if(name==='valtrex_claim_ticket_replies'){const rows=tables.valtrex_ticket_outbox||[];for(const row of rows)if(row.tenant_id===args.p_tenant&&row.state==='sending'&&Date.parse(row.started_at)<Date.now()-300000)row.state='uncertain';const selected=rows.filter(r=>r.tenant_id===args.p_tenant&&r.state==='pending'&&r.attempts<3).slice(0,5);for(const r of selected)Object.assign(r,{state:'sending',claim_token:webcrypto.randomUUID(),attempts:r.attempts+1,started_at:new Date().toISOString()});return {data:structuredClone(selected),error:null};}return {data:name==='valtrex_support_send'?{id:1,threadId:'00000068-0000-4000-8000-000000000001'}:true,error:null};},from(table){
  const rows=tables[table]||(tables[table]=[]);const filters=[];let mutation=null,limit=Infinity,offset=0,order=null,columns=null;
  const q={select(value){columns=value;return q;},in(k,values){filters.push(r=>values.includes(r[k]));return q;},range(a,b){offset=a;limit=b-a+1;return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},lt(k,v){filters.push(r=>k==='sort_id'?BigInt(r.message_id)<BigInt(v):Number(r[k])<Number(v));return q;},is(k,v){filters.push(r=>r[k]===v);return q;},or(text){assert.equal(text,`target_user_id.is.null,target_user_id.eq.${user}`);filters.push(r=>!r.target_user_id||r.target_user_id===user);return q;},limit(n){limit=n;return q;},order(k,options){order=[k,options];return q;},insert(v){mutation=['insert',v];return q;},upsert(v){mutation=['upsert',v];return q;},update(v){mutation=['update',v];return q;},delete(){mutation=['delete'];return q;},
   async single(){const r=await run();return {...r,data:r.data?.[0]||null};},async maybeSingle(){return q.single();},then(ok,bad){return run().then(ok,bad);}};
  async function run(){if(mutation&&Array.isArray(mutation[1])){if(mutation[0]==='insert'&&mutation[1].some(row=>rows.some(r=>same(table,r,row))))return {data:null,error:{code:'23505'}};for(const row of mutation[1]){const current=mutation[0]==='upsert'?rows.find(r=>same(table,r,row)):null;if(current)Object.assign(current,row);else rows.push({uses:0,active:true,priority:'normal',notes:'',created_at:new Date().toISOString(),...row});}return {data:mutation[1],error:null};}let matching=rows.filter(r=>filters.every(f=>f(r)));
   if(mutation){const[action,v]=mutation;
    if(action==='insert'||action==='upsert'){
      if(table==='valtrex_product_commands'&&rows.some(r=>r.tenant_id===v.tenant_id&&r.product_id===v.product_id&&r.state==='pending'))return {data:null,error:{code:'23505'}};
      if(action==='insert'&&['valtrex_workspace_config','valtrex_ticket_outbox','valtrex_manager_commands'].includes(table)&&rows.some(r=>same(table,r,v)))return {data:null,error:{code:'23505'}};let existing=action==='upsert'?rows.find(r=>same(table,r,v)):null;
      if(existing){Object.assign(existing,v);matching=[existing];}else{const row={id:webcrypto.randomUUID(),created_at:new Date().toISOString(),state:'pending',attempts:0,detail:'',archived:false,...v};rows.push(row);matching=[row];}
    }else if(action==='update'){matching.forEach(r=>Object.assign(r,v));}else if(action==='delete'){for(const row of matching)rows.splice(rows.indexOf(row),1);}
   }
   if(order)matching.sort((a,b)=>(order[0]==='sort_id'?(BigInt(a.message_id)>BigInt(b.message_id)?1:BigInt(a.message_id)<BigInt(b.message_id)?-1:0):order[0]==='id'&&/^\d+$/.test(String(a.id))&&/^\d+$/.test(String(b.id))?(BigInt(a.id)>BigInt(b.id)?1:BigInt(a.id)<BigInt(b.id)?-1:0):String(a[order[0]]).localeCompare(String(b[order[0]])))*(order[1]?.ascending===false?-1:1));
   return {data:structuredClone(matching.slice(offset,offset+limit).map(r=>columns&&columns!=='*'?Object.fromEntries(columns.split(',').filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]])):r)),count:matching.length,error:null};
  }return q;
 }};
 const source=readFileSync(new URL('../../supabase/functions/valtrex-cloud/index.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/u,'');
 vm.runInNewContext(transformSync(source,{loader:'ts',format:'iife',target:'es2022'}).code,{createClient:()=>db,Deno:{env:{get:n=>n==='SUPABASE_SERVICE_ROLE_KEY'?'test-role':null},serve:fn=>{handle=fn;}},fetch:async(url,options)=>{networkCalls.push({url:String(url),options});return externalFetch?externalFetch(url,options):Response.json({id:managerId,bot:true});},crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Response,Request,AbortSignal,Uint8Array,Date,Math,atob,btoa,console},{timeout:2000});
 async function call(path,{method='GET',data,auth='portal',headers={}}={}){
  const base='https://valtrexapplications.vercel.app';const h={'content-type':'application/json',origin:base,...(auth==='portal'?{cookie:`vtx_portal=${cookie}`,'x-valtrex-csrf':csrf}:auth==='bot'?{authorization:`Bearer ${bridge}`,'x-valtrex-application':app}:auth==='manager'?{authorization:`Bot ${'token_'.repeat(10)}`} : {}),...headers};
  const r=await handle(new Request(`${base}/${path}`,{method,headers:h,body:method==='GET'?undefined:JSON.stringify(data||{})}));return {status:r.status,body:await r.json()};
 }
 return {tables,call,calls,networkCalls,setFetch:fn=>{externalFetch=fn;},setManager:id=>{managerId=id;}};
}
