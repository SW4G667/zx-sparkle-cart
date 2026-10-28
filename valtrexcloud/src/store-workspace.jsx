import ProductCreator,{newProduct} from './product-creator.jsx';
import React,{useState,useEffect,useRef} from 'react';
import Icon from './icons.jsx';

export function ProductsPanel({appId,request,csrf}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState('');
  const [form,setForm]=useState(null),[message,setMessage]=useState('');
  const generation=useRef(0);
  const load=async()=>{
    const current=++generation.current;setError('');
    try {const result=await request(`/apps/${appId}/products`);if(current===generation.current)setData(result);}
    catch(e){if(current===generation.current)setError(e.message);}
  };
  useEffect(()=>{setData(null);setForm(null);load();const timer=setInterval(load,45000);return()=>{generation.current++;clearInterval(timer);};},[appId]);
  async function save(event){
    event.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{await request(`/apps/${appId}/products`,{method:'POST',csrf,data:form});setForm(null);setMessage('Alteração enviada. Aguarde a confirmação do bot.');await load();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const products=data?.products||[],commands=data?.commands||[];
  const queued=commands.filter(c=>c.state==='pending');
  const rows=products.filter(p=>`${p.name} ${p.description}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  const online=data?.seenAt&&Date.now()-Date.parse(data.seenAt)<150000;
  const labels={pending:'Aguardando o bot',applied:'Confirmado pelo bot',conflict:'Atualize e tente novamente',failed:'Não aplicado',cancelled:'Cancelado'};
  return <div className="store-workspace">
    <div className="store-status"><Icon name={online?'check':'clock'}/><div><strong>{online?'Catálogo conectado ao bot':data?.bridgeVersion?'Aguardando a próxima conexão':'Conecte a nova integração do bot'}</strong><p>{data?.seenAt?`Última sincronização: ${new Date(data.seenAt).toLocaleString('pt-BR')}.`:'Instale a atualização R67 do bot para receber seu catálogo. Você pode deixar novos produtos na fila.'} Alterações só aparecem como concluídas após confirmação.</p></div><button type="button" className="portal-outline" disabled={busy} onClick={load}><Icon name="refresh"/>Atualizar catálogo</button></div>
    {error&&<div className="portal-alert error" role="alert">{error}</div>}{message&&<div className="portal-alert" role="status">{message}</div>}
    <div className="store-toolbar"><label className="store-search"><Icon name="search"/><input aria-label="Buscar produtos" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar produto ou descrição"/></label><button type="button" className="portal-primary" disabled={busy} onClick={()=>{setMessage('');setForm(newProduct());}}><Icon name="plus"/>Novo produto</button></div>
    <div className="store-summary"><span><strong>{products.length}</strong> produtos sincronizados</span><span><strong>{queued.length}</strong> alterações pendentes</span></div>
    {form&&<ProductCreator value={form} onChange={setForm} busy={busy} save={save} close={()=>setForm(null)} bridgeVersion={data?.bridgeVersion}/>}
    {!data?<p role="status">Consultando catálogo…</p>:rows.length?<div className="store-products">{rows.slice(0,100).map(product=>{
      const pending=queued.some(c=>c.product_id===product.id);
      return <article className="store-product" key={product.id}><div className="store-product-icon"><Icon name="products" size={22}/></div><div><h3>{product.name}</h3><p>{product.description||'Sem descrição'}</p><div className="store-product-meta"><span>{product.delivery==='automatic'?'Entrega automática':'Entrega manual'}</span><span>{product.options} opções</span>{pending&&<span>Aguardando o bot</span>}</div></div><button type="button" className="portal-outline" disabled={busy||pending} onClick={()=>{setMessage('');setForm({productId:product.id,baseRevision:product.revision,name:product.name,description:product.description,delivery:product.delivery,banner:product.banner||'',footer:product.footer||'',appearance:product.appearance||newProduct().appearance});}}>Editar<Icon name="edit" size={15}/></button><button type="button" className="cloud-icon-button" aria-label={`Duplicar ${product.name}`} disabled={busy||pending} onClick={()=>setForm({...newProduct(),name:(product.name+" • cópia").slice(0,100),description:product.description,delivery:product.delivery,banner:product.banner||"",footer:product.footer||"",appearance:product.appearance||newProduct().appearance})}><Icon name="copy"/></button></article>;
    })}</div>:<div className="portal-empty"><Icon name="products" size={30}/><h3>{query?'Nenhum resultado':'Seu catálogo começa aqui'}</h3><p>{query?'Tente outro nome ou descrição.':'Crie um produto e acompanhe a confirmação do bot nesta página.'}</p></div>}
    {rows.length>100&&<p className="store-help">Mostrando os primeiros 100 resultados. Use a busca para encontrar outro produto.</p>}
    {commands.length>0&&<div className="store-history"><h3>Últimas alterações</h3>{commands.slice(0,20).map(c=><div key={c.id} className="store-history-row"><Icon name={c.state==='applied'?'check':c.state==='pending'?'clock':'info'}/><div><strong>{c.payload.name}</strong><small>{c.action==='create'?'Criação':'Edição'} · {new Date(c.created_at).toLocaleString('pt-BR')}{c.detail&&` · ${c.detail}`}</small></div><span className={`store-state state-${c.state}`}>{labels[c.state]||c.state}</span></div>)}</div>}
  </div>;
}

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
