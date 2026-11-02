export function expiryStatus90(expiresAt,now=Date.now()){
 const deadline=expiresAt?Date.parse(expiresAt):NaN;
 if(!Number.isFinite(deadline))return {label:'Prazo não informado',state:'unknown',days:null};
 const remaining=deadline-now;
 if(remaining<=0)return {label:'Bot vencido · precisa renovar',state:'expired',days:0};
 const days=Math.ceil(remaining/86400000);
 return {label:days===1?'Último dia · renove antes de vencer':`${days} dias para o bot vencer`,state:days<=3?'soon':'active',days};
}
