export const receiptTextNames96={buyerName:'Nome do comprador',buyerHandle:'Usuário do comprador',buyerDate:'Data e horário',orderId:'Número do pedido',title:'Título da confirmação',itemHeading:'Título dos itens',itemName:'Nome dos produtos',itemPrice:'Preço dos produtos',subtotalLabel:'Título do subtotal',subtotalValue:'Valor do subtotal',adjustmentLabel:'Título dos ajustes',adjustmentValue:'Valor dos ajustes',totalLabel:'Título do total pago',totalValue:'Valor pago',footerName:'Nome da loja',footerText:'Texto do rodapé',receiptLabel:'Título Recibo',paidLabel:'Selo Pago',buyer:'Bloco completo: comprador',items:'Bloco completo: itens',total:'Bloco completo: total',footer:'Bloco completo: rodapé'};
export const editableReceiptText96=['title','itemHeading','subtotalLabel','totalLabel','footerText','receiptLabel','paidLabel'];
export function normalizeReceiptElements96(input){const result={};for(const key of Object.keys(receiptTextNames96)){const e=input?.[key];if(!e||typeof e!=='object'||Array.isArray(e))continue;const clamp=(value,fallback,min,max)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
 const target={x:clamp(e.x,0,-720,720),y:clamp(e.y,0,-1200,1200),scale:clamp(e.scale,1,.25,3)};
 for(const [field,min,max] of [['fontSize',8,120],['rotation',-180,180],['letterSpacing',-3,18]])if(Number.isFinite(e[field]))target[field]=clamp(e[field],0,min,max);
 if(/^#[0-9a-f]{6}$/i.test(e.color||''))target.color=e.color;
 if(['sans','serif','mono'].includes(e.font))target.font=e.font;
 if(['left','center','right'].includes(e.align))target.align=e.align;
 for(const field of ['bold','visible'])if(typeof e[field]==='boolean')target[field]=e[field];
 if(editableReceiptText96.includes(key)&&typeof e.text==='string')target.text=e.text.slice(0,180);
 result[key]=target;
 }return result;}
