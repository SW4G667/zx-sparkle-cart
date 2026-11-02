export const operationDefaults={receipt:{model:'confirmed',font:'sans',text:'#fafafa',muted:'#999999',accent:'#e3e3e3',border:'#474747',background:'#111111',panel:'#242424',totalText:'#fafafa',backgroundImage:'',imageFromProduct:false,pingBuyer:true,pingSeconds:2,elements:{}},restock:{useImage:false,title:'RESTOCK! O produto {produto} acabou de receber novos itens!',content:'Campo: {campo}\nAdicionados: {adicionados}x\nEstoque total: {estoque}x',channelId:'',appearance:{accent:'#f5f5f5',text:'#ffffff',muted:'#b5b5b5',panel:'#171717',background:'#090909',position:'left',buttonStyle:2,elements:{}}},delivery:{instructions:'Confira e-mail e senha no arquivo privado. Nunca compartilhe suas credenciais.',confirmButton:true,supportThread:true,credentialExpiryHours:0,guaranteeDays:7},automations:[]};
import {normalizeReceiptElements96} from './receipt96.mjs';
export function normalizeOperations(value){
 const result=structuredClone(operationDefaults);
 for(const section of ['receipt','restock','delivery'])for(const [key,baseline]of Object.entries(operationDefaults[section]))if(!['elements','appearance'].includes(key)&&typeof value?.[section]?.[key]===typeof baseline)result[section][key]=value[section][key];
 const a=value?.restock?.appearance||{},target=result.restock.appearance;
 for(const key of ['accent','text','muted','panel','background'])if(/^#[0-9a-f]{6}$/i.test(a[key]||''))target[key]=a[key];
 if(['left','right'].includes(a.position))target.position=a.position;
 if([1,2,3,4].includes(a.buttonStyle))target.buttonStyle=a.buttonStyle;
 for(const key of ['title','stock','added','date','footer']){const p=a.elements?.[key];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.scale))target.elements[key]={x:Math.max(-150,Math.min(150,p.x)),y:Math.max(-100,Math.min(100,p.y)),scale:Math.max(.65,Math.min(1.4,p.scale))};}
 result.receipt.elements=normalizeReceiptElements96(value?.receipt?.elements);
 if(Array.isArray(value?.automations))result.automations=value.automations.slice(0,20).filter(a=>a&&typeof a==='object').map(a=>Object.fromEntries(['id','kind','enabled','channelId','content','intervalMinutes','stockThreshold','timezone','quietStart','quietEnd','days'].filter(key=>Object.hasOwn(a,key)).map(key=>[key,key==='days'?(Array.isArray(a.days)?a.days.filter(v=>Number.isInteger(v)&&v>=0&&v<=6):[]):a[key]])));
 return result;
}
export function parseStockFile(text,format='txt',delimiter=';'){
 if(typeof text!=='string'||text.length>120000)throw Error('Escolha um arquivo de até 120 KB.');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),items=[];let skipped=0;
 for(const line of lines){if(!line.trim()){skipped++;continue;}let item=line.trim();
  if(format==='csv'){
   const columns=[];let field='',quoted=false;
   for(let n=0;n<line.length;n++){const char=line[n];if(char==='"'){if(quoted&&line[n+1]==='"'){field+='"';n++;}else if(!field||quoted)quoted=!quoted;else throw Error('Aspas inválidas no CSV.');}else if(char===delimiter&&!quoted){columns.push(field);field='';}else field+=char;}
   if(quoted)throw Error('O CSV contém aspas não fechadas.');columns.push(field);item=columns[0].trim();
   if(items.length===0&&/^(item|estoque|credencial|conta)$/i.test(item)){skipped++;continue;}
  }
  if(!item||item.length>1500||/[\x00\r\n]/.test(item))throw Error('Há uma linha inválida ou maior que 1.500 caracteres.');items.push(item);
 }
 const unique=[...new Set(items)];if(!unique.length||unique.length>500)throw Error('Importe entre 1 e 500 itens por lote.');
 return {entries:unique,duplicates:items.length-unique.length,skipped,preview:unique.slice(0,5).map((_,i)=>`Item ${i+1} · conteúdo privado`)};
}
export async function payloadDigest(value){const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sort(value))));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function formatAge(value){if(!value)return 'Sem contato confirmado';const seconds=Math.max(0,Math.floor((Date.now()-Date.parse(value))/1000));return seconds<60?`há ${seconds} s`:seconds<3600?`há ${Math.floor(seconds/60)} min`:`há ${Math.floor(seconds/3600)} h`;}
