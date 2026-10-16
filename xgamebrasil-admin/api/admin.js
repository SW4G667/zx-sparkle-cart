const crypto=require('node:crypto');
const ADMIN=(process.env.ADMIN_EMAIL||'pereiraionara759@gmail.com').toLowerCase();
const send=(res,s,d)=>res.status(s).json(d);
const okEnv=()=>!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const validUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s||'');
const limited=(s,n=150)=>String(s??'').trim().slice(0,n);
const slug=s=>limited(s,100).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
async function sql(table,method='GET',query='',body){
 const url=process.env.SUPABASE_URL+'/rest/v1/'+table+(query?'?'+query:'');
 const r=await fetch(url,{method,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=null}
 if(!r.ok)throw Error('Banco de dados indisponível ('+r.status+')');
 return d;
}
async function adminUser(req){
 const auth=String(req.headers.authorization||'');
 if(!/^Bearer [a-zA-Z0-9_\-.]+$/.test(auth))return false;
 const r=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:auth}});
 if(!r.ok)return false;
 const u=await r.json();
 return !!(u.id&&u.email?.toLowerCase()===ADMIN&&(u.email_confirmed_at||u.confirmed_at));
}
function formatProduct(b){
 if(!limited(b.title,110)||!Number.isInteger(+b.price_cents)||+b.price_cents<=0||+b.price_cents>100000000)throw Error('Nome ou preço inválido');
 const photo=limited(b.image_url,1200);
 if(photo&&!/^https:\/\/[^\s"'<>]+$/.test(photo))throw Error('Imagem deve ter endereço HTTPS');
 const category=validUuid(b.category_id)?b.category_id:null;
 return {title:limited(b.title,110),slug:slug(b.slug||b.title),description:limited(b.description,4000),category_id:category,price_cents:+b.price_cents,compare_cents:b.compare_cents?Math.max(0,+b.compare_cents):null,image_url:photo||null,badge:limited(b.badge,28)||null,active:b.active===true,featured:b.featured===true,delivery_mode:b.delivery_mode==='manual'?'manual':'code',available_quantity:Math.max(0,Math.min(999999,parseInt(b.available_quantity)||0)),updated_at:new Date().toISOString()};
}
function htmlEsc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','>':'&gt;',"'":'&#39;'}[c]))}
async function email(to,subject,html){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw Error('Configure RESEND_API_KEY e EMAIL_FROM na Vercel');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,html})});
 if(!r.ok)throw Error('Falha ao enviar e-mail');
 return r.json();
}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const action=String(req.query.action||'overview');
 try{
 if(action==='config'&&req.method==='GET')return send(res,200,{configured:okEnv(),auth_url:process.env.SUPABASE_URL||'',anon_key:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'',admin_email:ADMIN});
 if(!okEnv())return send(res,503,{error:'Conexão com banco de dados ainda não configurada'});
 if(!await adminUser(req))return send(res,403,{error:'Acesso negado. Confirme a conta com o e-mail autorizado.'});
 if(action==='me')return send(res,200,{email:ADMIN});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 if(action==='overview'&&req.method==='GET'){
  const [products,orders,feedback,categories]=await Promise.all([
   sql('xg_products','GET','select=id,title,price_cents,active,delivery_mode,created_at&order=created_at.desc'),
   sql('xg_orders','GET','select=id,product_title,amount_cents,status,buyer_email,method,created_at&order=created_at.desc&limit=100'),
   sql('xg_feedback','GET','select=*&order=created_at.desc&limit=100'),
   sql('xg_categories','GET','select=*&order=position.asc')
  ]);
  const gross=orders.filter(o=>['paid','processing','delivered'].includes(o.status)).reduce((a,o)=>a+o.amount_cents,0);
  return send(res,200,{products,orders,feedback,categories,stats:{gross,paid:orders.filter(o=>['paid','processing','delivered'].includes(o.status)).length,pending:orders.filter(o=>o.status==='pending').length,active:products.filter(p=>p.active).length}});
 }
 if(action==='products'&&req.method==='GET'){
  const [products,codes]=await Promise.all([sql('xg_products','GET','select=*&order=created_at.desc'),sql('xg_codes','GET','select=id,product_id,order_id')]);
  const count={};codes.forEach(c=>{if(!c.order_id)count[c.product_id]=(count[c.product_id]||0)+1});
  return send(res,200,{products:products.map(p=>({...p,code_stock:count[p.id]||0}))});
 }
 if(action==='product-save'&&req.method==='POST'){
  const data=formatProduct(b),id=validUuid(b.id)?b.id:null;
  const result=id?await sql('xg_products','PATCH','id=eq.'+id,data):await sql('xg_products','POST','',data);
  return send(res,200,{product:result?.[0]});
 }
 if(action==='product-delete'&&req.method==='POST'){
  if(!validUuid(b.id))return send(res,400,{error:'ID inválido'});
  const orders=await sql('xg_orders','GET','product_id=eq.'+b.id+'&select=id&limit=1');
  if(orders.length)return send(res,409,{error:'Produto possui pedidos. Desative-o em vez de excluir.'});
  await sql('xg_products','DELETE','id=eq.'+b.id);return send(res,200,{ok:true});
 }
 if(action==='categories'&&req.method==='GET')return send(res,200,{categories:await sql('xg_categories','GET','select=*&order=position.asc')});
 if(action==='category-save'&&req.method==='POST'){
  const name=limited(b.name,70),url=slug(b.slug||name);if(name.length<2||!url)throw Error('Categoria inválida');
  const data={name,slug:url,active:b.active!==false,position:Math.max(0,parseInt(b.position)||0)},id=validUuid(b.id)?b.id:null;
  const rows=id?await sql('xg_categories','PATCH','id=eq.'+id,data):await sql('xg_categories','POST','',data);
  return send(res,200,{category:rows?.[0]});
 }
 if(action==='category-delete'&&req.method==='POST'){
  if(!validUuid(b.id))throw Error('ID inválido');
  await sql('xg_categories','DELETE','id=eq.'+b.id);return send(res,200,{ok:true});
 }
 if(action==='codes'&&req.method==='GET'){
  if(!validUuid(req.query.product_id))throw Error('Produto inválido');
  const codes=await sql('xg_codes','GET','product_id=eq.'+req.query.product_id+'&select=id,order_id,created_at&order=created_at.desc&limit=300');
  return send(res,200,{codes});
 }
 if(action==='codes-add'&&req.method==='POST'){
  if(!validUuid(b.product_id))throw Error('Produto inválido');
  const values=[...new Set(String(b.codes||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x.length>=3&&x.length<=255))];
  if(!values.length||values.length>100)throw Error('Informe de 1 a 100 códigos por vez');
  const rows=await sql('xg_codes','POST','',values.map(secret_code=>({product_id:b.product_id,secret_code})));
  return send(res,200,{added:rows.length});
 }
 if(action==='codes-remove'&&req.method==='POST'){
  if(!validUuid(b.id))throw Error('ID inválido');
  await sql('xg_codes','DELETE','id=eq.'+b.id+'&order_id=is.null');return send(res,200,{ok:true});
 }
 if(action==='orders'&&req.method==='GET')return send(res,200,{orders:await sql('xg_orders','GET','select=id,product_title,amount_cents,status,method,currency,buyer_email,buyer_feedback,created_at,paid_at,email_sent_at&order=created_at.desc&limit=300')});
 if(action==='order-process'&&req.method==='POST'){
  if(!validUuid(b.id)||!['processing','delivered'].includes(b.status))throw Error('Solicitação inválida');
  const rows=await sql('xg_orders','GET','id=eq.'+b.id+'&select=status,buyer_email');
  if(!rows?.[0]||!['paid','processing','delivered'].includes(rows[0].status))throw Error('Pagamento não confirmado');
  if(b.status==='delivered'&&!rows[0].buyer_email)throw Error('Cliente não informou e-mail');
  await sql('xg_orders','PATCH','id=eq.'+b.id,{status:b.status});return send(res,200,{ok:true});
 }
 if(action==='feedback'&&req.method==='GET')return send(res,200,{feedback:await sql('xg_feedback','GET','select=*&order=created_at.desc&limit=300')});
 if(action==='feedback-publish'&&req.method==='POST'){
  if(!validUuid(b.id))throw Error('ID inválido');
  const f=await sql('xg_feedback','GET','id=eq.'+b.id+'&select=is_test');
  if(!f.length||f[0].is_test)throw Error('Feedback de teste não pode aparecer como avaliação real');
  await sql('xg_feedback','PATCH','id=eq.'+b.id,{published:!!b.published});return send(res,200,{ok:true});
 }
 if(action==='feedback-test'&&req.method==='POST'){
  const body=limited(b.body||'Teste interno: recebimento de feedback',1200);
  await sql('xg_feedback','POST','',{body,name:'Teste da administração',is_test:true,published:false,rating:5});
  return send(res,200,{ok:true});
 }
 if(action==='settings'&&req.method==='GET'){
  const rows=await sql('xg_settings','GET','key=eq.store&select=value');return send(res,200,{settings:rows[0]?.value||{}});
 }
 if(action==='settings-save'&&req.method==='POST'){
  const value={headline:limited(b.headline,140),subtitle:limited(b.subtitle,320),announcement:limited(b.announcement,140),support_email:limited(b.support_email,180),theme:'azure'};
  await sql('xg_settings','PATCH','key=eq.store',{value});
  return send(res,200,{ok:true});
 }
 if(action==='image-upload'&&req.method==='POST'){
   const mime=String(b.mime||''),buffer=Buffer.from(String(b.base64||''),'base64');
   if(!['image/png','image/jpeg','image/webp'].includes(mime)||buffer.length===0||buffer.length>2*1024*1024)throw Error('Use PNG, JPEG ou WebP de até 2 MB');
   const valid=(mime==='image/png'&&buffer.subarray(0,4).toString('hex')==='89504e47')||(mime==='image/jpeg'&&buffer.subarray(0,3).toString('hex')==='ffd8ff')||(mime==='image/webp'&&buffer.subarray(8,12).toString()==='WEBP');
   if(!valid)throw Error('Arquivo de imagem inválido');
   const ext=mime==='image/png'?'png':mime==='image/jpeg'?'jpg':'webp',name=crypto.randomUUID()+'.'+ext;
   const result=await fetch(process.env.SUPABASE_URL+'/storage/v1/object/xg-product-images/'+name,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':mime,'x-upsert':'false'},body:buffer});
   if(!result.ok)throw Error('Verifique se o bucket xg-product-images foi criado no banco');
   return send(res,200,{url:process.env.SUPABASE_URL+'/storage/v1/object/public/xg-product-images/'+name});
 }
 if(action==='test-email'&&req.method==='POST'){
  await email(ADMIN,'XGameBrasil | Teste do sistema','<h1>XGameBrasil</h1><p>Teste de envio do painel administrativo. Nenhuma compra foi realizada.</p>');
  return send(res,200,{ok:true});
 }
 return send(res,404,{error:'Operação não encontrada'});
 }catch(e){console.error('admin',action,e.message);return send(res,400,{error:e.message})}
};