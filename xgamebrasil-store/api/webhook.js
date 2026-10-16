const crypto=require('node:crypto');
const json=(res,s,data)=>res.status(s).json(data);
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return json(res,405,{error:'method'});
 const key=process.env.MAGNUS_WEBHOOK_SECRET||process.env.MAGNUS_API_KEY;
 if(!key||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return json(res,503,{error:'not configured'});
 const header=String(req.headers['x-mc-signature']||'').trim().replace(/^sha256=/i,'');
 if(!/^[a-f0-9]{64}$/i.test(header))return json(res,401,{error:'invalid signature'});
 // O Vercel pode fazer parse do JSON antes deste handler; reconstrução NÃO serve para verificar HMAC.
 // Defina bodyParser:false para preservar os bytes brutos exatamente como enviados.
 let raw='';
 try{for await(const chunk of req){raw+=chunk.toString('utf8');if(Buffer.byteLength(raw)>64000)return json(res,413,{error:'too large'})}}catch{return json(res,400,{error:'invalid request'})}
 const expected=crypto.createHmac('sha256',key).update(raw).digest('hex');
 if(!crypto.timingSafeEqual(Buffer.from(header,'hex'),Buffer.from(expected,'hex')))return json(res,401,{error:'invalid signature'});
 let body;try{body=JSON.parse(raw)}catch{return json(res,400,{error:'invalid json'})}
 const e=body.event,d=body.data||{};
 if(!['transaction.created','transaction.completed','transaction.failed'].includes(e))return json(res,200,{received:true});
 const providerId=String(d.id||d.transactionId||'');
 if(!providerId)return json(res,400,{error:'missing provider id'});
 const base=process.env.SUPABASE_URL+'/rest/v1/xg_orders';
 const headers={apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation'};
 const read=await fetch(base+'?provider_id=eq.'+encodeURIComponent(providerId)+'&select=id,amount_cents,status',{headers});
 if(!read.ok)return json(res,503,{error:'db unavailable'});
 const rows=await read.json(),o=rows[0];
 if(!o)return json(res,200,{received:true});
 if(e==='transaction.completed'&&String(d.status).toUpperCase()==='COMPLETED'){
   if(Math.round(Number(d.amount)*100)!==o.amount_cents)return json(res,422,{error:'amount mismatch'});
   const update=await fetch(base+'?id=eq.'+o.id+'&status=eq.pending',{method:'PATCH',headers,body:JSON.stringify({status:'paid',paid_at:new Date().toISOString()})});
   if(!update.ok)return json(res,503,{error:'db unavailable'});
 }else if(e==='transaction.failed'){
   await fetch(base+'?id=eq.'+o.id+'&status=eq.pending',{method:'PATCH',headers,body:JSON.stringify({status:'failed'})});
 }
 return json(res,200,{received:true});
};
module.exports.config={api:{bodyParser:false}};