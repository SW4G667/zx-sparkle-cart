import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,app,user} from './helpers/edge.mjs';
import {DEFAULT_PUBLIC_ORIGIN,publicSiteOrigin,publicSiteMetadata} from '../site-config.mjs';
const custom='https://loja.example.com';
const project=()=>fixture({base:custom,env:{VALTREX_CLOUD_PUBLIC_URL:custom}});
const config=f=>f.call(`portal/apps/${app}/config`);

test('custom domain controls the callback, preview and config links without trusting the Host header',async()=>{
 const f=await fixture({base:custom,env:{VALTREX_CLOUD_PUBLIC_URL:'https://LOJA.example.com/'}});
 const health=await f.call('health',{auth:'none',headers:{host:'attacker.example.com','x-forwarded-host':'attacker.example.com'}});
 assert.equal(health.body.redirectUri,custom+'/api/auth/discord/callback');
 const current=await config(f);assert.equal(current.status,200);assert.equal(current.body.redirectUri,health.body.redirectUri);assert.equal(current.body.verifyUrl,custom+'/v/'+app);
 const preview=await f.call(`portal/apps/${app}/preview`,{method:'POST'});assert.equal(preview.status,200);assert.ok(preview.body.link.startsWith(custom+'/preview/'+app+'/'));
});

test('unsafe domain configuration falls back safely in frontend and backend',async()=>{
 for(const input of ['http://loja.example.com','https://user:password@loja.example.com','https://loja.example.com/path','https://loja.example.com/?next=bad','https://loja.example.com/#bad','https://loja.example.com:8443','https://localhost','https://127.0.0.1','https://2130706433','https://[::1]','https://service.internal','https://loja.example.com\\@evil.com','https://loja.\nexample.com']){
  assert.equal(publicSiteOrigin(input),null,input);
  const f=await fixture({env:{VALTREX_CLOUD_PUBLIC_URL:input}}),r=await f.call('health',{auth:'none'});
  assert.equal(r.status,200,input);assert.equal(r.body.redirectUri,DEFAULT_PUBLIC_ORIGIN+'/api/auth/discord/callback',input);
 }
 assert.equal(publicSiteOrigin('https://LOJA.example.com:443/'),custom);
});

test('portal mutations accept the canonical custom origin and CSRF only',async()=>{
 const f=await project();
 assert.equal((await f.call(`portal/apps/${app}/config`,{method:'PUT',data:{theme:{title:'Minha loja'}}})).status,200);
 for(const origin of [DEFAULT_PUBLIC_ORIGIN,custom+'.evil.example','https://evil.example.com','null',''])assert.equal((await f.call(`portal/apps/${app}/config`,{method:'PUT',headers:{origin},data:{theme:{title:'Never save'}}})).status,403,origin);
 assert.equal((await f.call(`portal/apps/${app}/config`,{method:'PUT',headers:{'x-valtrex-csrf':''},data:{theme:{title:'Never save'}}})).status,403);
 assert.equal((await config(f)).body.theme.title,'Minha loja');
});

test('OAuth starts and errors stay on the canonical domain with protected cookies',async()=>{
 const f=await fixture({base:custom,env:{VALTREX_CLOUD_PUBLIC_URL:custom,VALTREX_PORTAL_CLIENT_SECRET:'portal-fixture'}});
 const r=await f.rawCall('auth/portal',{auth:'none'});assert.equal(r.status,302);
 const target=new URL(r.headers.get('location'));assert.equal(target.origin,'https://discord.com');assert.equal(target.searchParams.get('redirect_uri'),custom+'/api/auth/discord/callback');assert.equal(f.tables.valtrex_oauth_states.length,1);
 const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Path=\/api\/auth/);assert.ok(!cookie.includes('Domain='));
 const invalid=await f.rawCall('auth/discord/callback?state=bad',{auth:'none'});assert.equal(invalid.status,302);assert.ok(invalid.headers.get('location').startsWith(custom+'/result?status=invalid'));
});

test('malformed cookies are refused without an internal server error',async()=>{
 const f=await fixture();const response=await f.call('portal/me',{auth:'none',headers:{cookie:'vtx_portal=%zz'}});assert.equal(response.status,401);assert.ok(!JSON.stringify(response).includes('URIError'));
});

for(const issuer of [undefined,'https://trusted-ai.example.com'])test('hosted AI keeps its explicit trusted issuer when the public domain changes: '+(issuer||'existing Space'),async()=>{
 const f=await fixture({base:custom,env:{VALTREX_CLOUD_PUBLIC_URL:custom,...(issuer?{VALTREX_CLOUD_AI_ISSUER:issuer}:{})}});
 f.tables.valtrex_manager_web=[{id:1,administrator_ids:[user],site_owner_ids:[user]}];
 f.tables.valtrex_managed_apps=[{bot_id:app,owner_user_id:user,status:'active',expires_at:'2099-01-01'}];
 const defaults=(await f.call(`portal/apps/${app}/workspace`)).body;
 assert.equal((await f.call('manager/site/ai/access',{auth:'manager',method:'POST',data:{botId:app,ownerId:user,actorId:user,enabled:true,tickets:true,community:true}})).status,200);
 assert.equal((await f.call(`portal/apps/${app}/workspace`,{method:'PUT',data:{revision:defaults.revision,cloudAI:{...defaults.cloudAI,enabled:true,ticketsEnabled:true}}})).status,200);
 let claims;f.setFetch(async(_url,options)=>{const permit=new Headers(options.headers).get('x-cloud-permit');claims=JSON.parse(Buffer.from(permit.split('.')[1],'base64url').toString());return Response.json({text:'Olá!',model:'fixture'});});
 const result=await f.call(`portal/apps/${app}/workspace/cloud-ai/test`,{method:'POST',data:{message:'Oi!'}});assert.equal(result.status,200);assert.equal(claims.iss,issuer||DEFAULT_PUBLIC_ORIGIN);assert.equal(claims.aud,'cloud-support');assert.ok(claims.exp>claims.iat&&claims.exp-claims.iat<=60);
});

test('domain diagnostics are restricted to administrators and privileged URL commands reject private targets',async()=>{
 const f=await project();assert.equal((await f.call('portal/platform/status')).status,403);
 f.tables.valtrex_manager_web=[{id:1,administrator_ids:[user],site_owner_ids:[user]}];
 const r=await f.call('portal/platform/status');assert.equal(r.status,200);assert.equal(r.body.site.publicUrl,custom);assert.equal(r.body.site.redirectUri,custom+'/api/auth/discord/callback');assert.equal(r.body.site.aiIssuer,DEFAULT_PUBLIC_ORIGIN);assert.ok(!JSON.stringify(r.body.site).includes('secret'));
 const invalid=await f.call('portal/platform/commands',{method:'POST',data:{clientId:'00000089-0000-4000-8000-000000000001',kind:'site_url',payload:{url:'https://user:password@loja.example.com'}}});assert.equal(invalid.status,400);assert.equal(f.tables.valtrex_manager_commands.length,0);
});

test('production HTML has CSP without arbitrary scripts, framing or unnecessary device permissions',()=>{
 const v=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 const headers=Object.fromEntries(v.headers.find(h=>h.source==='/(.*)').headers.map(h=>[h.key.toLowerCase(),h.value]));
 const csp=headers['content-security-policy'];for(const directive of ["script-src 'self'","connect-src 'self'","object-src 'none'","base-uri 'none'","frame-ancestors 'none'","style-src 'self' 'unsafe-inline'","img-src 'self' https: data: blob:"])assert.ok(csp.includes(directive),directive);
 assert.ok(!csp.includes('unsafe-eval'));assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"));assert.equal(headers['x-content-type-options'],'nosniff');assert.equal(headers['x-frame-options'],'DENY');assert.equal(headers['referrer-policy'],'no-referrer');assert.equal(headers['strict-transport-security'],'max-age=31536000');assert.ok(!headers['strict-transport-security'].includes('includeSubDomains'));assert.ok(headers['permissions-policy'].includes('camera=()'));
 const api=v.headers.find(h=>h.source==='/api/:path*');assert.ok(api.headers.some(h=>h.key==='Cache-Control'&&h.value.includes('no-store')));
 assert.ok(v.rewrites.some(r=>r.source==='/api/:path*'&&r.destination.startsWith('https://nrtsagqxlsmtkijetnya.supabase.co/')));
});

test('custom build metadata updates both HTML pages and discovery files from one public origin',()=>{
 const plugin=publicSiteMetadata(custom),emitted=[];
 for(const path of ['../index.html','../plans/index.html']){const html=readFileSync(new URL(path,import.meta.url),'utf8');const rendered=plugin.transformIndexHtml(html);assert.ok(!rendered.includes(DEFAULT_PUBLIC_ORIGIN));assert.ok(rendered.includes(custom));assert.ok(rendered.includes('rel="canonical"'));}
 plugin.generateBundle.call({emitFile:v=>emitted.push(v)});assert.deepEqual(emitted.map(v=>v.fileName),['robots.txt','sitemap.xml']);for(const file of emitted){assert.ok(!file.source.includes(DEFAULT_PUBLIC_ORIGIN));assert.ok(file.source.includes(custom));}
 const fallback=publicSiteMetadata('https://user:password@loja.example.com').transformIndexHtml(readFileSync(new URL('../index.html',import.meta.url),'utf8'));assert.ok(fallback.includes(DEFAULT_PUBLIC_ORIGIN));assert.ok(!fallback.includes('password'));
});
