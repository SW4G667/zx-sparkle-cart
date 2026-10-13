const http = require('node:http');
const crypto = require('node:crypto');
const {URL}=require('node:url');
const port=Number(process.env.PORT||3000);
const password=process.env.DASHBOARD_PASSWORD;
const secret=process.env.DASHBOARD_SECRET;
const target=process.env.DESKTOP_URL||'';
if(!password||!secret||secret.length<24){console.error('Configure DASHBOARD_PASSWORD e DASHBOARD_SECRET privados');process.exit(1);}
if(target && !/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/.*)?$/i.test(target)){console.error('DESKTOP_URL deve ser HTTPS');process.exit(1);}
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const sign=(v)=>crypto.createHmac('sha256',secret).update(v).digest('hex');
const attempts=new Map();
function ok(req){
 const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='));
 if(!cookie)return false;
 const v=cookie.slice(8),i=v.lastIndexOf('.');
 if(i<0)return false;
 const exp=v.slice(0,i);
 return /^\d+$/.test(exp)&&Date.now()<Number(exp)&&equal(v.slice(i+1),sign(exp));
}
function page(body){
 return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zenyx Desktop</title>'+
 '<style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui;color:#eef;background:radial-gradient(circle at 80% 15%,#334166,#080c18 70%)}main{width:min(92vw,480px);padding:30px;background:#161f33;border:1px solid #384460;border-radius:24px}h1{margin:12px 0}p{color:#b6c2dc;line-height:1.5}input,button,a.btn{display:block;width:100%;padding:15px;margin-top:12px;border-radius:12px;font:inherit}input{background:#0b1020;color:white;border:1px solid #63718a}button,a.btn{background:#667efa;color:white;text-align:center;text-decoration:none;border:0;font-weight:700}</style>'+
 '<main><small>ZENYX • EXPERIMENTAL</small>'+body+'</main></html>';
}
function send(res,code,body,extra={}){
 res.writeHead(code,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff',...extra});res.end(body);
}
http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('ok');}
 if(path==='/login'&&req.method==='POST'){
  let text='';
  req.on('data',chunk=>{text+=chunk;if(text.length>2048)req.destroy()});
  return req.on('end',()=>{
   const ip=req.socket.remoteAddress||'unknown',now=Date.now();
   const state=attempts.get(ip)||{count:0,start:now};
   if(now-state.start>600000){state.count=0;state.start=now;}
   state.count++;attempts.set(ip,state);
   const supplied=new URLSearchParams(text).get('password')||'';
   if(state.count>8||!equal(supplied,password))return send(res,403,page('<h1>Acesso negado</h1><p>Senha incorreta ou limite de tentativas.</p>'));
   attempts.delete(ip);
   const expiry=String(now+12*60*60*1000),secure=req.headers['x-forwarded-proto']==='https'?'; Secure':'';
   res.writeHead(303,{Location:'/', 'Set-Cookie':'session='+expiry+'.'+sign(expiry)+'; HttpOnly; SameSite=Strict; Path=/'+secure});res.end();
  });
 }
 if(path==='/logout')return send(res,200,page('<h1>Sessão encerrada</h1><a class="btn" href="/">Voltar</a>'),{'Set-Cookie':'session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/'});
 if(!ok(req))return send(res,200,page('<h1>Desktop remoto</h1><p>Insira a senha do painel.</p><form action="/login" method="post"><input type="password" name="password" required><button>Entrar</button></form>'));
 const link=target?'<a class="btn" href="'+target.replaceAll('&','&amp;')+'">Abrir desktop</a>':'<p>DESKTOP_URL ainda não configurada.</p>';
 return send(res,200,page('<h1>Ambiente experimental</h1><p>O painel não executa Roblox. O desktop remoto requer serviço Linux e senha VNC separados.</p>'+link+'<a class="btn" href="/logout">Sair</a>'));
}).listen(port,'0.0.0.0',()=>console.log('Painel ouvindo na porta '+port));
