import React,{useState,useEffect,useRef} from 'react';
import Icon from './icons.jsx';

export {default as ProductsPanel} from './catalog-workspace.jsx';

export function NotificationCenter({request,csrf,planApps=[],openPlan}){
  const [notifications,setNotifications]=useState([]),[error,setError]=useState('');
  async function load(){try{const data=await request('/notifications');setNotifications(data.notifications||[]);setError('');}catch(e){setError(e.message);}}
  useEffect(()=>{let active=true;const reload=async()=>{try{const data=await request('/notifications');if(active){setNotifications(data.notifications||[]);setError('');}}catch(e){if(active)setError(e.message);}};reload();const timer=setInterval(reload,60000);return()=>{active=false;clearInterval(timer);};},[]);
  async function read(id){try{await request(`/notifications/${id}/read`,{method:'POST',csrf});setNotifications(items=>items.map(n=>n.id===id?{...n,read:true}:n));}catch(e){setError(e.message);}}
  const unread=notifications.filter(n=>!n.read).length;
  return <details className="notices notification-center"><summary aria-label={`Notificações${unread?`, ${unread} não lidas`:''}`}><Icon name="bell"/>{(unread+planApps.length)>0&&<i/>}</summary><section><div className="notices-title"><strong>Notificações</strong><span>{unread} não lidas</span></div>{error&&<div className="notification-error" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
    {notifications.map(n=><article className={`site-notice ${n.read?'read':''}`} key={n.id}><span className="notice-dot"/><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString('pt-BR')}</small><div className="notice-actions">{n.link&&/^https:\/\//i.test(n.link)&&<a href={n.link} target="_blank" rel="noopener noreferrer">Abrir link<Icon name="external" size={12}/></a>}{!n.read&&<button type="button" onClick={()=>read(n.id)}>Marcar como lida</button>}</div></div></article>)}
    {planApps.map(a=><button type="button" key={`${a.source}:${a.id}`} onClick={e=>{e.currentTarget.closest('details').open=false;openPlan(a);}}><Icon name="clock"/><span><strong>{a.label}</strong><small>Confira a validade do seu plano</small></span><Icon name="right" size={16}/></button>)}
    {!error&&!notifications.length&&!planApps.length&&<div className="notices-empty"><Icon name="check" size={25}/><p>Você está em dia. Novos avisos aparecerão aqui.</p></div>}
  </section></details>;
}

export function VerificationAppearance({theme,update,preview}){
  const speed=theme.loadingSpeed??6,overlay=theme.loadingOverlay??55;
  return <div className="verification-appearance"><div><span className="portal-overline">EXPERIÊNCIA DE VERIFICAÇÃO</span><h3>Uma transição com a sua identidade</h3><p>O indicador é contínuo. A confirmação só aparece após a autorização no Discord.</p></div><div className="portal-fields"><label className="portal-field"><span>Velocidade da animação · {speed}s</span><input type="range" min="3" max="12" value={speed} onChange={e=>update({loadingSpeed:Number(e.target.value)})}/><small>Mais segundos deixam o movimento mais lento.</small></label><label className="portal-field"><span>Escurecimento da imagem · {overlay}%</span><input type="range" min="0" max="90" value={overlay} onChange={e=>update({loadingOverlay:Number(e.target.value)})}/></label><label className="portal-field"><span>Posição da imagem</span><select value={theme.loadingPosition||'center'} onChange={e=>update({loadingPosition:e.target.value})}><option value="top">Superior</option><option value="center">Centralizada</option><option value="bottom">Inferior</option></select></label><label className="store-toggle"><input type="checkbox" checked={theme.loadingTransparent!==false} onChange={e=>update({loadingTransparent:e.target.checked})}/><span>Painel do carregamento transparente</span></label></div><button type="button" className="portal-outline" onClick={preview}><Icon name="monitor"/>Visualizar carregamento salvo</button><small>Salve a aparência antes de abrir a prévia. O link é temporário e não inicia uma verificação.</small></div>;
}
