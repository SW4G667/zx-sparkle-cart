import React, { useEffect, useState } from 'react';
import './plans.css';
import { BRAND, displayName } from './branding.mjs';
import { safeInvite } from './preferences.mjs';

const FEATURES = {
  sales: ['Produtos e variações', 'Vitrine com Embed Normal ou Components V2', 'Estoque e reestoque', 'Checkout com valor antes do pagamento', 'Tickets e automações', 'Cloud e Gifts'],
  robux: ['Catálogo de produtos Robux', 'Cálculo e checkout', 'Pedidos e histórico', 'Fluxos de entrega configuráveis', 'Cloud e Gifts', 'Gerenciamento pelo Discord'],
};
const FALLBACK = [
  { profile: 'sales', name: 'Bot de Vendas', description: 'Vendas, atendimento e automações para sua loja no Discord.', options: [] },
  { profile: 'robux', name: 'Bot de Robux', description: 'Uma operação dedicada aos seus pedidos e produtos de Robux.', options: [] },
];
const money = amount => Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Plans() {
  const [catalog, setCatalog] = useState({ loading: true, plans: FALLBACK, officialInvite: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/catalog', { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('catalog'); return response.json(); })
      .then(data => setCatalog({ loading: false, plans: data.plans?.length ? data.plans : FALLBACK, officialInvite: safeInvite(data.officialInvite) }))
      .catch(() => { if (!controller.signal.aborted) setCatalog({ loading: false, plans: FALLBACK, officialInvite: null }); });
    return () => controller.abort();
  }, []);
  return <div className="plans-page">
    <header className="plans-header"><a className="plans-brand" href="/"><span>☁</span><strong>{BRAND}</strong></a>
      <nav aria-label="Navegação principal"><a href="/">Início</a><a href="/plans" aria-current="page">Planos</a><a href="/dashboard">Meu painel</a></nav></header>
    <main className="plans-main">
      <div className="plans-intro"><span className="plans-kicker">APLICAÇÕES PARA DISCORD</span><h1>Escolha o bot certo<br/><em>para a sua operação.</em></h1>
        <p>Conheça os recursos e compare os planos configurados no Manager. Compra e renovação acontecem somente no servidor oficial pelo Discord.</p></div>
      <div className="plans-grid">{catalog.plans.map((plan, index) => <article className="plans-card" key={plan.profile}>
        <div className="plans-card-top"><span className="plans-index">0{index + 1} / {plan.profile === 'sales' ? 'VENDAS' : 'ROBUX'}</span><span className="plans-orbit" aria-hidden="true">{plan.profile === 'sales' ? '◈' : '◇'}</span></div>
        <h2>{displayName(plan.name)}</h2><p className="plans-description">{displayName(plan.description)}</p>
        <div className="plans-rule"/><h3>O que você pode fazer</h3><ul>{(FEATURES[plan.profile] || []).map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
        <div className="plans-rule"/><h3>Planos disponíveis</h3>
        {plan.options?.length ? <div className="plans-options">{plan.options.map((option, i) => <div key={`${option.label}-${i}`}><span><strong>{option.label}</strong><small>{option.days} dia{option.days === 1 ? '' : 's'}</small></span><b>{money(option.price)}</b></div>)}</div>
          : <p className="plans-unavailable">Os valores aparecem aqui após a sincronização do Manager.</p>}
        {catalog.officialInvite ? <a className="plans-buy" href={catalog.officialInvite} target="_blank" rel="noopener noreferrer">Comprar ou renovar no Discord <span aria-hidden="true">↗︎</span></a>
          : <div className="plans-buy-disabled" role="status">{catalog.loading ? 'Carregando convite oficial…' : 'Convite oficial ainda não configurado no Manager'}</div>}
      </article>)}</div>
      <section className="plans-after"><div><span>COMO FUNCIONA</span><h2>Comece pelo Discord.<br/>Gerencie pelo painel.</h2></div><ol><li>Entre no servidor oficial e escolha seu plano.</li><li>Após a ativação, faça login no site com Discord.</li><li>Suas aplicações vinculadas aparecem no painel.</li></ol></section>
    </main><footer className="plans-footer"><span>© {BRAND}</span><a href="/dashboard">Acessar meu painel ↗︎</a></footer>
  </div>;
}
