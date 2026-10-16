const crypto=require('node:crypto');
const API='https://api.magnuspay.com.br';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const validUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s||'');
const json=(res,status,data)=>res.status(status).json(data);
function configured(){return !!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)}
async function db(table,method='GET',query='',data){
 const u=process.env.SUPABASE_URL+'/rest/v1/'+table+(query?'?'+query:'');
 const r=await fetch(u,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:data===undefined?undefined:JSON.stringify(data)});
 const t=await r.text();let v;try{v=t?JSON.parse(t):null}catch{v=t}
 if(!r.ok)throw Error('DB '+r.status+': '+(v?.message||'erro'));
 return v;
}
async function gateway(path,method='GET',body){
 const r=await fetch(API+path,{method,headers:{'X-API-Key':process.env.MAGNUS_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 const v=await r.json();
 if(!r.ok||!v.success)throw Error(v.message||'Pagamento indisponível');
 return v.data;
}
function safeOrder(o){return {id:o.id,status:o.status,product_title:o.product_title,amount_cents:o.amount_cents,method:o.method,currency:o.currency,has_email:!!o.buyer_email,created_at:o.created_at,provider_data:o.status==='pending'?o.provider_data:{}}}
async function validOrder(id,token){
 if(!validUuid(id)||!token||token.length<32||token.length>150)return null;
 const rows=await db('xg_orders','GET','id=eq.'+id+'&select=*'+'&limit=1');
 const o=rows?.[0];if(!o)return null;
 const a=Buffer.from(o.access_token_hash,'hex'),b=Buffer.from(hash(token),'hex');
 return a.length===b.length&&crypto.timingSafeEqual(a,b)?o:null;
}
async function rateLimit(req){
 const ip=(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'unknown').split(',')[0].slice(0,90);
 const fingerprint=hash((process.env.IP_HASH_SALT||'XGameBrasil')+':'+ip);
 const since=new Date(Date.now()-60000).toISOString();
 const records=await db('xg_rate_limits','GET','fingerprint=eq.'+fingerprint+'&created_at=gte.'+encodeURIComponent(since)+'&select=id&limit=9');
 if(records.length>=8)throw Error('Muitas tentativas. Aguarde um minuto.');
 await db('xg_rate_limits','POST','',{fingerprint});
 return fingerprint;
}
async function sendEmail(to,subject,html){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return false;
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,html})});
 if(!r.ok)throw Error('Envio de email temporariamente indisponível');
 return true;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const action=String(req.query.action||'catalog');
 try{
 if(action==='health')return json(res,200,{ok:true,configured:configured(),payments:!!process.env.MAGNUS_API_KEY,email:!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM)});
 if(action==='catalog'&&req.method==='GET'){
  if(!configured())return json(res,200,{configured:false,categories:[],products:[],settings:{headline:'Tudo para o seu próximo nível.',subtitle:'Produtos digitais, atendimento humano e uma experiência simples.',announcement:'Bem-vindo à XGameBrasil'},feedback:[]});
  const [cats,products,settings,feedback]=await Promise.all([
    db('xg_categories','GET','active=eq.true&order=position.asc&select=id,name,slug'),
    db('xg_products','GET','active=eq.true&order=created_at.desc&select=id,category_id,title,slug,description,price_cents,compare_cents,image_url,badge,featured,delivery_mode,available_quantity'),
    db('xg_settings','GET','key=eq.store&select=value'),
    db('xg_feedback','GET','published=eq.true&is_test=eq.false&order=created_at.desc&limit=6&select=name,rating,body,created_at')
  ]);
  return json(res,200,{configured:true,categories:cats,products:products.map(p=>({...p,available_quantity:p.delivery_mode==='manual'?p.available_quantity:p.available_quantity})),settings:settings[0]?.value||{},feedback});
 }
 if(action==='methods'&&req.method==='GET'){
  if(!process.env.MAGNUS_API_KEY)return json(res,200,{pix:false,crypto:[]});
  let crypto=[];try{const d=await gateway('/crypto-deposits/currencies');crypto=(d.currencies||[]).filter(x=>x.enabled).map(x=>({code:x.code,name:x.name,network:x.network})).slice(0,50)}catch{}
  return json(res,200,{pix:true,crypto});
 }
 if(req.method!=='POST')return json(res,405,{error:'Método não permitido'});
 const host='https://'+req.headers.host;const origin=req.headers.origin;
 if(origin&&origin!==host&&origin!==process.env.STORE_ORIGIN)return json(res,403,{error:'Origem não autorizada'});
 if(!configured())return json(res,503,{error:'Loja em preparação. Compras temporariamente indisponíveis.'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(action==='create'){
  if(!process.env.MAGNUS_API_KEY)return json(res,503,{error:'Checkout ainda não configurado'});
  const fingerprint=await rateLimit(req);
  if(!validUuid(b.product_id))return json(res,400,{error:'Produto inválido'});
  const rows=await db('xg_products','GET','id=eq.'+b.product_id+'&active=eq.true&limit=1&select=*');
  const p=rows[0];if(!p)return json(res,404,{error:'Produto indisponível'});
  if(p.delivery_mode==='manual'&&p.available_quantity<=0)return json(res,409,{error:'Produto esgotado'});
  if(p.delivery_mode==='code'){
    const stock=await db('xg_codes','GET','product_id=eq.'+p.id+'&order_id=is.null&select=id&limit=1');
    if(!stock.length)return json(res,409,{error:'Produto esgotado'});
  }
  if(!['pix','crypto'].includes(b.method))return json(res,400,{error:'Forma de pagamento inválida'});
  let currency=null;
  if(b.method==='crypto'){
   const d=await gateway('/crypto-deposits/currencies');
   const option=(d.currencies||[]).find(x=>x.enabled&&x.code===b.currency);
   if(!option)return json(res,400,{error:'Moeda indisponível'});
   currency=option.code;
  }
  const token=crypto.randomBytes(32).toString('hex');
  const order=await db('xg_orders','POST','',{product_id:p.id,product_title:p.title,amount_cents:p.price_cents,method:b.method,currency,access_token_hash:hash(token),customer_ip_hash:fingerprint});
  const o=order[0];let payment;
  try{
   payment=b.method==='pix'
     ?await gateway('/transactions/create','POST',{amount:p.price_cents/100,description:'XGameBrasil Pedido '+o.id.slice(0,8),feeToCustomer:false})
     :await gateway('/crypto-deposits','POST',{amount:p.price_cents/100,currency});
   const providerId=String(b.method==='pix'?payment.transactionId:payment.id||'');
   if(!providerId)throw Error('Pagamento sem identificador');
   const publicData=b.method==='pix'?{qr:payment.qrCodeBase64||payment.qrcodeUrl||'',copy:payment.copyPaste||'',expires:'15 minutos'}:{qr:payment.qrCode||'',address:payment.payAddress||'',payAmount:payment.payAmount,coin:payment.coin,network:payment.network,expires:payment.expiresAt};
   await db('xg_orders','PATCH','id=eq.'+o.id,{provider_id:providerId,provider_data:publicData});
   return json(res,201,{order_id:o.id,token,payment:publicData,status:'pending'});
  }catch(e){await db('xg_orders','PATCH','id=eq.'+o.id,{status:'failed'}).catch(()=>{});throw e}
 }
 if(action==='status'){
   const o=await validOrder(b.order_id,b.token);if(!o)return json(res,404,{error:'Pedido não encontrado'});
   // Em caso de webhook atrasado, conferir pagamento diretamente com o provedor, nunca confiar no navegador.
   if(o.status==='pending'&&o.provider_id&&process.env.MAGNUS_API_KEY){
     try{
       const p=o.method==='pix'?await gateway('/transactions/check','POST',{transactionId:o.provider_id}):await gateway('/crypto-deposits/'+encodeURIComponent(o.provider_id));
       if(String(p.status).toUpperCase()==='COMPLETED'&&Math.round(Number(p.amount)*100)===o.amount_cents){
         await db('xg_orders','PATCH','id=eq.'+o.id+'&status=eq.pending',{status:'paid',paid_at:new Date().toISOString()});o.status='paid';
       }
       if(['EXPIRED','FAILED'].includes(String(p.status).toUpperCase())){await db('xg_orders','PATCH','id=eq.'+o.id+'&status=eq.pending',{status:'expired'});o.status='expired'}
     }catch{}
   }
   return json(res,200,{order:safeOrder(o)});
 }
 if(action==='submit'){
  await rateLimit(req);
  const o=await validOrder(b.order_id,b.token);if(!o)return json(res,404,{error:'Pedido não encontrado'});
  if(!['paid','processing','delivered'].includes(o.status))return json(res,409,{error:'Aguarde a confirmação do pagamento'});
  const email=String(b.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180)return json(res,400,{error:'Informe um e-mail válido'});
  if(o.buyer_email&&o.buyer_email!==email)return json(res,409,{error:'E-mail já confirmado. Contate o suporte para alterações.'});
  const feedback=String(b.feedback||'').trim().slice(0,1000);
  await db('xg_orders','PATCH','id=eq.'+o.id,{buyer_email:email,buyer_feedback:feedback||null,status:o.status==='delivered'?'delivered':'processing'});
  if(feedback&&!o.buyer_feedback)await db('xg_feedback','POST','',{order_id:o.id,body:feedback,name:'Cliente verificado',published:false,is_test:false});
  if(o.email_sent_at)return json(res,200,{status:'delivered',message:'Seu código já foi enviado para o e-mail cadastrado.'});
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return json(res,202,{status:'processing',message:'Pedido confirmado e em processamento. O envio por e-mail será realizado após a configuração do serviço.'});
  const claim=await db('rpc/xg_claim_code','POST','',{p_order_id:o.id});
  const c=claim?.[0];
  if(!c||c.mode!=='code'||!c.secret_code)return json(res,202,{status:'processing',message:'Pedido em processamento pela equipe. Você receberá uma atualização no seu e-mail.'});
  await sendEmail(email,'Seu pedido XGameBrasil '+o.id.slice(0,8),'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>XGameBrasil</h1><p>Pagamento confirmado. Seu código de resgate:</p><p style="padding:20px;background:#edf2ff;font-size:25px;letter-spacing:2px;font-weight:bold">'+esc(c.secret_code)+'</p><p>Pedido #'+esc(o.id.slice(0,8))+'</p><p>Guarde este código e não compartilhe com terceiros.</p></div>');
  await db('xg_orders','PATCH','id=eq.'+o.id,{status:'delivered',email_sent_at:new Date().toISOString()});
  return json(res,200,{status:'delivered',message:'Código enviado para seu e-mail.'});
 }
 return json(res,404,{error:'Operação desconhecida'});
 }catch(e){console.error('shop',action,e.message);return json(res,400,{error:e.message.startsWith('DB ')?'Erro ao processar solicitação. Tente novamente.':e.message||'Erro interno'})}
};