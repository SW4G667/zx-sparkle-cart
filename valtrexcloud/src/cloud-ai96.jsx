import React,{useEffect,useRef,useState,useId} from 'react';
import Assistant95 from './assistant95.jsx';
import {Avatar96,cloudDefaults96,cloudName100} from './cloud-ai96-personalization.jsx';
import './cloud-ai96.css';
export default function CloudAIWidget96({appId,request,csrf,fullPage=false}){
 const [open,setOpen]=useState(false),[started,setStarted]=useState(false),[settings,setSettings]=useState(cloudDefaults96);const button=useRef(null),windowRef=useRef(null),id=useId(),alive=useRef(true);
 useEffect(()=>{let current=true;alive.current=true;setOpen(false);setStarted(false);setSettings(cloudDefaults96);request(`/apps/${appId}/assistant/settings`).then(r=>{if(current)setSettings({...cloudDefaults96,...r.settings,displayName:r.displayName});}).catch(()=>{});return()=>{current=false;alive.current=false;};},[appId,request]);
 useEffect(()=>{const changed=e=>{if(e.detail?.appId===appId)setSettings({...cloudDefaults96,...e.detail.settings});};window.addEventListener('cloudai96:settings',changed);return()=>window.removeEventListener('cloudai96:settings',changed);},[appId]);
 useEffect(()=>{if(!open)return;const previous=document.activeElement,close=e=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};window.addEventListener('keydown',close);windowRef.current?.querySelector('button')?.focus();return()=>{window.removeEventListener('keydown',close);if(previous?.isConnected)previous.focus();};},[open]);
 function toggle(){if(fullPage){document.querySelector('[aria-label="Mensagem para o assistente"]')?.focus();return;}setStarted(true);setOpen(v=>!v);}
 const name=cloudName100(settings);
 return <><button ref={button} type="button" className="cloud96-fab" onClick={toggle} aria-label={(open?'Fechar ':'Abrir ')+name} aria-expanded={open} aria-controls={id}><Avatar96 settings={settings} size={57}/><span className="cloud96-fab-dot"/><span className="cloud96-fab-tooltip">Converse com {name}</span></button>{started&&<aside ref={windowRef} id={id} role="dialog" aria-modal="false" aria-label={name} className="cloud96-window" hidden={!open||fullPage}><div className="cloud96-window-header"><Avatar96 settings={settings} size={44}/><div><strong>{name}</strong><small>Sua companhia para criar e resolver</small></div><a href="#assistant" aria-label={'Abrir '+name+' em tela cheia'} onClick={()=>setOpen(false)}>↗</a><button type="button" aria-label={'Fechar janela de '+name} onClick={()=>setOpen(false)}>×</button></div><Assistant95 key={appId} appId={appId} request={request} csrf={csrf} embedded/></aside>}</>;
}
