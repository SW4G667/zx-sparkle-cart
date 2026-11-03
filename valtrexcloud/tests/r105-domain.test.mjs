import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,app} from './helpers/edge.mjs';
import {DEFAULT_PUBLIC_ORIGIN,LEGACY_PUBLIC_ORIGIN,LEGACY_SITE_ORIGINS,publicSiteMetadata} from '../site-config.mjs';
test('legacy public settings migrate to SynxApps while the registered Discord callback remains usable',async()=>{
 for(const configured of [undefined,...LEGACY_SITE_ORIGINS]){
  const f=await fixture({env:{...(configured?{VALTREX_CLOUD_PUBLIC_URL:configured}:{}),VALTREX_PORTAL_CLIENT_SECRET:'fixture'}});
  const health=await f.call('health',{auth:'none'});assert.equal(health.body.redirectUri,LEGACY_PUBLIC_ORIGIN+'/api/auth/discord/callback');
  const config=await f.call(`portal/apps/${app}/config`);assert.equal(config.body.verifyUrl,DEFAULT_PUBLIC_ORIGIN+'/v/'+app);
  assert.equal((await f.call(`portal/apps/${app}/config`,{method:'PUT',data:{theme:{title:'Synx'}}})).status,200);
  const oauth=await f.rawCall('auth/portal',{auth:'none'});assert.equal(new URL(oauth.headers.get('location')).searchParams.get('redirect_uri'),health.body.redirectUri);assert.ok(!oauth.headers.get('set-cookie').includes('Domain='));
  const callback=await f.rawCall('auth/discord/callback?state=bad',{auth:'none'});assert.ok(callback.headers.get('location').startsWith(DEFAULT_PUBLIC_ORIGIN+'/result'));
 }
});
test('owned legacy browser routes migrate but API clients and AI keys never receive a domain redirect',()=>{
 const rules=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8')).redirects;
 for(const host of LEGACY_SITE_ORIGINS.map(v=>new URL(v).host)){
  const matching=rules.filter(r=>r.has.some(h=>h.type==='host'&&new RegExp('^'+h.value+'$').test(host)));assert.equal(matching.length,2);
  const callback=matching.find(r=>r.source==='/api/auth/discord/callback');assert.equal(callback.destination,DEFAULT_PUBLIC_ORIGIN+'/api/auth/discord/callback');assert.equal(callback.permanent,false);
  const pages=matching.find(r=>r.source.startsWith('/:path(')),pattern=new RegExp('^/'+pages.source.slice(7,-1)+'$');
  for(const path of ['/','/dashboard','/plans','/g/token'])assert.equal(pattern.test(path),true,path);
  for(const path of ['/api/health','/api/cloud-ai/jwks','/api/manager/site/ai/test','/api/portal/me'])assert.equal(pattern.test(path),false,path);
 }
});
test('metadata uses the new public hostname even when a build has a legacy URL configured',()=>{
 for(const configured of [undefined,...LEGACY_SITE_ORIGINS]){
  const plugin=publicSiteMetadata(configured),html=plugin.transformIndexHtml(readFileSync(new URL('../index.html',import.meta.url),'utf8'));assert.ok(html.includes(DEFAULT_PUBLIC_ORIGIN));for(const old of LEGACY_SITE_ORIGINS)assert.ok(!html.includes(old));
 }
});
