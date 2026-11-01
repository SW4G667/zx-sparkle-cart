import {readFileSync} from 'node:fs';
export const DEFAULT_PUBLIC_ORIGIN='https://valtrexapplications.vercel.app';

export function publicSiteOrigin(value){
 if(typeof value!=='string'||value.length>300||/[\s\\\u0000-\u001f\u007f]/.test(value))return null;
 try{
  const url=new URL(value),host=url.hostname.toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||
   !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host)||
   /(?:^|\.)(?:localhost|local|internal)$/.test(host))return null;
  return url.origin;
 }catch{return null;}
}

// Only a public origin is read here. No backend secret enters the Vite build.
export function publicSiteMetadata(origin=DEFAULT_PUBLIC_ORIGIN){
 const base=publicSiteOrigin(origin)||DEFAULT_PUBLIC_ORIGIN;
 const replace=source=>source.replaceAll(DEFAULT_PUBLIC_ORIGIN,base);
 return {name:'public-site-metadata',transformIndexHtml:replace,generateBundle(){
  for(const name of ['robots.txt','sitemap.xml'])this.emitFile({type:'asset',fileName:name,source:replace(readFileSync(new URL('./public/'+name,import.meta.url),'utf8'))});
 }};
}
