export const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents||0)/100);
export function periodDates(days=30,now=new Date(),zone='America/Sao_Paulo'){
 const until=now.toLocaleDateString('en-CA',{timeZone:zone});
 const from=new Date(Date.parse(until+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);return {from,until,zone};
}
export function trendDays(from,until,days=[]){
 const lookup=new Map(days.map(d=>[d.day,d]));const result=[];
 for(let stamp=Date.parse(from+'T12:00:00Z'),last=Date.parse(until+'T12:00:00Z');stamp<=last&&result.length<366;stamp+=86400000){const day=new Date(stamp).toISOString().slice(0,10);result.push({day,confirmed_cents:0,manual_cents:0,orders:0,...lookup.get(day)});}
 return result;
}
const safe=value=>{const s=String(value??'');return '"'+(/^[\s]*[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};
export function financeCsv(rows){
 return '\ufeff'+[['Pedido','Data UTC','Produto','Quantidade','Valor BRL','Desconto BRL','Classificação','Entrega','Forma de pagamento'],...rows.map(r=>[r.order_ref,r.occurred_at,r.product_name,r.quantity,(r.amount_cents/100).toFixed(2),(r.discount_cents/100).toFixed(2),r.state,r.delivery,r.payment_method])].map(row=>row.map(safe).join(';')).join('\r\n');
}
export const stateLabels={confirmed:'Confirmado',manual:'Aprovação manual',unclassified:'Sem classificação',refunded:'Estornado',cancelled:'Cancelado'};
export const deliveryLabels={delivered:'Entregue',pending:'Entrega pendente',unknown:'Não informado'};
