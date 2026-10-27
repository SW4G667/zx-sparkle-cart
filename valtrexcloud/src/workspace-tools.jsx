import React, { useState } from 'react';
import { PALETTES, DEFAULT_PREFERENCES, filterLogs, logsCsv } from './preferences.mjs';

export function LoginVisual() {
  return <div className="cloud-login-visual" aria-hidden="true"><div className="cloud-orbit orbit-one"/><div className="cloud-orbit orbit-two"/>
    <div className="cloud-visual-center"><svg viewBox="0 0 64 64" fill="none"><path d="M19 47h27a12 12 0 0 0 1-24 17 17 0 0 0-32-3 14 14 0 0 0 4 27Z" stroke="currentColor" strokeWidth="2.5"/><path d="m26 32 6-6 6 6M32 26v15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
    <div className="cloud-float float-one"><span>01</span><div><strong>Suas aplicações</strong><small>Uma visão completa</small></div><b>↗</b></div>
    <div className="cloud-float float-two"><span>02</span><div><strong>Sua identidade</strong><small>Seu próprio estilo</small></div><b>◐</b></div>
    <div className="cloud-float float-three"><span>03</span><div><strong>Sua comunidade</strong><small>Conexões com consentimento</small></div><b>◇</b></div>
    <div className="cloud-art-caption">MENOS ABAS. MAIS CONTROLE.</div></div>;
}

export function AppToolbar({ query, setQuery, status, setStatus, preferences, update }) {
  return <div className="cloud-toolbar"><label className="cloud-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar aplicação por nome ou ID" placeholder="Buscar nome ou ID…" value={query} onChange={e => setQuery(e.target.value)}/></label>
    <label><span className="sr-only">Estado do plano</span><select aria-label="Filtrar estado do plano" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os planos</option><option value="active">Ativos</option><option value="expired">Vencidos</option><option value="suspended">Suspensos</option><option value="unknown">Sem informação</option></select></label>
    <label><span className="sr-only">Ordenação</span><select aria-label="Ordenar aplicações" value={preferences.sort} onChange={e => update({ sort: e.target.value })}><option value="name">Nome A–Z</option><option value="expiry">Vencimento</option><option value="status">Estado do plano</option></select></label>
    <div className="cloud-segment" aria-label="Exibição"><button aria-label="Exibir em cards" aria-pressed={preferences.layout === 'grid'} onClick={() => update({ layout: 'grid' })}>▦</button><button aria-label="Exibir em lista" aria-pressed={preferences.layout === 'list'} onClick={() => update({ layout: 'list' })}>☷</button></div></div>;
}

export function PreferencesPanel({ value, update }) {
  return <div className="cloud-preferences"><section><span className="portal-overline">PERSONALIZE SEU ESPAÇO</span><h3>Do seu jeito.</h3><p>Estas preferências ficam neste navegador. A aparência pública de cada aplicação é configurada em Aparência.</p>
    <h4>Cor de destaque</h4><div className="cloud-swatches">{Object.entries(PALETTES).map(([key, color]) => <button key={key} aria-pressed={value.palette === key} onClick={() => update({ palette: key })}><i style={{ background: color }}/>{({ mint: 'Verde-água', blue: 'Azul céu', amber: 'Âmbar' })[key]}{value.palette === key && <span>✓</span>}</button>)}</div>
    <div className="cloud-preview"><span className="cloud-preview-chip">PRÉVIA DO WORKSPACE</span><strong>Um espaço para suas ideias.</strong><div><i/><i/><i/></div><button disabled>Seu destaque →</button></div></section>
    <section><h4>Organização</h4><label className="cloud-option"><span><strong>Interface compacta</strong><small>Menos espaço entre os elementos.</small></span><input type="checkbox" checked={value.density === 'compact'} onChange={e => update({ density: e.target.checked ? 'compact' : 'comfortable' })}/></label>
    <label className="cloud-option"><span><strong>Reduzir animações</strong><small>Uma navegação com menos movimento.</small></span><input type="checkbox" checked={value.reducedMotion} onChange={e => update({ reducedMotion: e.target.checked })}/></label>
    <label className="cloud-option"><span><strong>Avisos de vencimento</strong><small>Destacar planos próximos do fim na visão geral.</small></span><input type="checkbox" checked={value.expiryNotice} onChange={e => update({ expiryNotice: e.target.checked })}/></label>
    <button className="portal-outline" onClick={() => update(DEFAULT_PREFERENCES)}>Restaurar preferências</button></section></div>;
}

export function ActivityPanel({ logs, refresh, onError }) {
  const [query, setQuery] = useState('');
  const [since, setSince] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = filterLogs(logs, query, since);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([logsCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'cloud-atividade.csv'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <><div className="cloud-toolbar"><label className="cloud-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar evento" placeholder="Filtrar eventos…" value={query} onChange={e => setQuery(e.target.value)}/></label><label className="cloud-date">A partir de<input type="date" value={since} onChange={e => setSince(e.target.value)}/></label>
    <button className="portal-outline" disabled={!rows.length} onClick={exportCsv}>Exportar CSV ↓</button><button className="portal-outline" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); } catch (error) { onError(error.message); } finally { setBusy(false); } }}>{busy ? 'Atualizando…' : 'Atualizar ↻'}</button></div>
    <p className="cloud-result-count">{rows.length} de {logs.length} evento(s) carregado(s)</p>
    {rows.length ? <div className="portal-timeline">{rows.map((row, index) => <div key={`${row.created_at}-${index}`}><span className="portal-timeline-dot"/><div><strong>{String(row.event || 'Evento').replaceAll('_', ' ')}</strong><small>{new Date(row.created_at).toLocaleString('pt-BR')}</small></div></div>)}</div> : <div className="portal-empty"><h3>Nenhum evento encontrado</h3><p>Tente outro filtro ou atualize o histórico desta aplicação.</p></div>}</>;
}

export function SetupChecklist({ config, open }) {
  const steps = [{ label: 'Autenticação cadastrada', done: config?.secretConfigured, tab: 'cloud' },
    { label: 'Servidor principal definido', done: Boolean(config?.guildId), tab: 'cloud' },
    { label: 'Canal de verificação publicado', done: Boolean(config?.verifyChannelId), tab: 'verification' }];
  return <div className="cloud-setup"><div><span className="portal-overline">PRÓXIMOS PASSOS</span><h3>Prepare sua aplicação</h3><p>{steps.filter(s => s.done).length} de 3 etapas concluídas</p></div><div>{steps.map(step => <button key={step.label} onClick={() => open(step.tab)}><span className={step.done ? 'done' : ''}>{step.done ? '✓' : '○'}</span>{step.label}<b>→</b></button>)}</div></div>;
}

export function HelpPanel({ invite }) {
  const items = [
    ['Como vincular minha aplicação?', 'No painel do seu bot no Discord, abra Cloud e vincule a conta proprietária. Atualize a lista de aplicações neste site.'],
    ['Onde inicio, reinicio ou renovo o bot?', 'O controle do processo e as renovações ficam na central do Manager, no servidor oficial. O portal mostra os dados sincronizados e gerencia a configuração Cloud.'],
    ['Por que a aplicação não aparece?', 'Confira se você entrou com a mesma conta Discord registrada como proprietária. Uma sincronização recente do Manager também pode ser necessária.'],
    ['Como funciona a recuperação?', 'Somente membros que autorizaram a finalidade podem participar. Cada autorização tem validade; um Gift não recupera membros sem consentimento.'],
    ['Como revogo o acesso?', 'No Discord, abra Configurações → Aplicativos autorizados e revogue a aplicação. Para sair deste portal, use Sair da conta.'],
  ];
  return <div className="cloud-help">{items.map(([title, text]) => <details key={title}><summary>{title}</summary><p>{text}</p></details>)}{invite && <a className="portal-primary" href={invite} target="_blank" rel="noopener noreferrer">Abrir servidor de suporte ↗</a>}</div>;
}
