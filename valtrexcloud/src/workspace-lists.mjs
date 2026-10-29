const fold=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('pt-BR');
export const stamp=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};
export const ticketStates={open:'Aberto',waiting:'Respondido',closed:'Encerrado',unknown:'Não informado'};
export const supportTopics={general:'Dúvida geral',billing:'Pagamentos e planos',technical:'Problema técnico'};
export function supportRows(threads=[],applications=[]){
 const labels=new Map();for(const app of applications)for(const id of [app.id,app.botId,app.bot_id])if(id)labels.set(String(id),app.label||app.name||String(id));
 return threads.map(t=>({id:String(t.id),title:supportTopics[t.topic]||'Atendimento',customer:t.owner_id||'Cliente',application:t.application_label||labels.get(String(t.tenant_id))||String(t.tenant_id||'Aplicação'),status:Object.hasOwn(ticketStates,t.status)?t.status:'unknown',priority:'normal',updatedAt:t.updated_at,unread:stamp(t.owner_sent_at)>stamp(t.support_read_at)}));
}
export function discordTicketRows(threads=[]){return threads.map(t=>({id:String(t.channel_id),title:t.title||'Ticket do Discord',customer:t.customer||'Cliente',application:'Discord',status:Object.hasOwn(ticketStates,t.status)?t.status:'unknown',priority:['high','normal','low'].includes(t.priority)?t.priority:'normal',updatedAt:t.synced_at,unread:false}));}
export function filterTickets(rows,{query='',status='all',priority='all',unread=false,sort='recent'}={}){
 const term=fold(query),rank={high:0,normal:1,low:2};
 return rows.filter(t=>(status==='all'||t.status===status)&&(priority==='all'||t.priority===priority)&&(!unread||t.unread)&&fold(`${t.id} ${t.title} ${t.customer} ${t.application}`).includes(term)).sort((a,b)=>{
  if(sort==='priority'){const d=(rank[a.priority]??1)-(rank[b.priority]??1);if(d)return d;}
  const order=sort==='oldest'?1:-1;return order*(stamp(a.updatedAt)-stamp(b.updatedAt))||String(a.id).localeCompare(String(b.id));
 });
}
export function pageOf(rows,page=1,size=12){size=Number.isInteger(size)&&size>0&&size<=100?size:12;page=Number.isFinite(Number(page))?Math.floor(Number(page)):1;const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.max(1,Math.min(pages,Number(page)||1));return {rows:rows.slice((current-1)*size,current*size),page:current,pages,total:rows.length};}
export function mergeChatMessages(previous=[],incoming=[]){const map=new Map();for(const m of [...previous,...incoming])map.set(String(m.id),m);return [...map.values()].sort((a,b)=>{try{return BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0;}catch{return stamp(a.created_at)-stamp(b.created_at);}});}
export function catalogRows(products=[],commands=[]){
 const latest=new Map(),pending=new Map();for(const c of commands){if(!latest.has(c.product_id)||stamp(c.created_at)>stamp(latest.get(c.product_id).created_at))latest.set(c.product_id,c);if(c.state==='pending')pending.set(c.product_id,c);}
 const rows=products.map(p=>({...p,pending:pending.has(p.id),pendingCreation:false,change:latest.get(p.id)||null})),seen=new Set(products.map(p=>p.id));
 for(const [id,c]of pending)if(!seen.has(id)&&c.action==='create'&&c.payload?.kind!=='robux')rows.push({...c.payload,id,options:c.payload?.initialOption?1:0,pending:true,pendingCreation:true,change:c});
 return rows;
}
export function filterCatalog(rows,{query='',delivery='all',state='all',sort='name'}={}){
 const term=fold(query);return rows.filter(p=>fold(`${p.name} ${p.description||''} ${p.id}`).includes(term)&&(delivery==='all'||p.delivery===delivery)&&(state==='all'||(state==='pending'?p.pending:state==='empty'?!p.pending&&!Number(p.options):state==='attention'?!p.pending&&['failed','conflict'].includes(p.change?.state):!p.pending))).sort((a,b)=>sort==='options'?Number(b.options||0)-Number(a.options||0)||String(a.name).localeCompare(String(b.name),'pt-BR'):(sort==='name-desc'?-1:1)*String(a.name).localeCompare(String(b.name),'pt-BR'));
}
export function safeCatalogImage(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.href:null;}catch{return null;}}
export function validateProductDraft(form){
 if(!form||typeof form.name!=='string'||!form.name.trim()||form.name.length>100)return 'Informe um nome de até 100 caracteres.';
 if(typeof form.description!=='string'||form.description.length>2000)return 'A descrição aceita até 2.000 caracteres.';
 if(!['manual','automatic'].includes(form.delivery))return 'Escolha uma forma de entrega válida.';
 if(form.banner&&!safeCatalogImage(form.banner))return 'Use um banner HTTPS válido, sem credenciais no endereço.';
 if(String(form.footer||'').length>500)return 'O rodapé aceita até 500 caracteres.';
 const a=form.appearance;
 if(a&&(!['editorial','consolidated'].includes(a.mode)||!['secondary','primary','success'].includes(a.buttonStyle)||typeof a.buttonLabel!=='string'||a.buttonLabel.length>80||a.accent&&!/^#[a-f\d]{6}$/i.test(a.accent)))return 'Revise o modelo, o botão e a cor da apresentação.';
 if(form.initialOption){const o=form.initialOption;if(form.productId)return 'A primeira opção só pode ser criada junto com um produto novo.';if(!String(o.name||'').trim()||o.name.length>60||!Number.isFinite(o.price)||o.price<.01||o.price>1000000||Math.abs(o.price*100-Math.round(o.price*100))>1e-6)return 'Informe o nome e um preço válido para a primeira opção, com até duas casas decimais.';}
 return '';
}
