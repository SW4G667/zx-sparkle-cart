import PlatformAdmin from './platform-admin.jsx';
import {AISettings,TicketInbox,TicketSettings} from './service-workspace.jsx';
import GiftStudio from './gift-studio.jsx';
import React, { useEffect, useState, useRef } from 'react';
import Icon from './icons.jsx';
import { BRAND, displayName } from './branding.mjs';
import { readPreferences, normalizePreferences, PUBLIC_PRESETS, filterApps, safeInvite, formatDate } from './preferences.mjs';
import { LoginVisual, AppToolbar, PreferencesPanel, ActivityPanel, SetupChecklist, HelpPanel, ApplicationGrid, GiftList, CommandMenu } from './workspace-tools.jsx';

import { ProductsPanel, NotificationCenter, VerificationAppearance } from './store-workspace.jsx';

import { FinancePanel, SupportWorkspace } from './finance-chat.jsx';

const apiRoot = '/api/portal';
const nav = [['overview','Visão geral'],['apps','Aplicações'],['products','Produtos'],['finance','Rendimentos'],['tickets','Tickets de clientes'],['ticket-settings','Preferências de atendimento'],['ai','Inteligência artificial'],['chat','Suporte da plataforma'],['verification','Verificação'],['cloud','Autenticação'],['gifts','Gifts'],['appearance','Aparência pública'],['subscriptions','Planos'],['logs','Atividade'],['preferences','Preferências'],['platform','Administração'],['help','Ajuda']];
function Brand() { return <a href="/" className="portal-brand"><span className="portal-brand-icon" aria-hidden="true"><Icon name="cloud" size={24}/></span><span>{BRAND}<span className="portal-brand-light">SEU WORKSPACE</span></span></a>; }

async function request(path, { method = 'GET', data, csrf } = {}) {
  const response = await fetch(`${apiRoot}${path}`, {
    method, credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-valtrex-csrf': csrf || '' },
    body: method === 'GET' ? undefined : JSON.stringify(data || {}),
    signal: AbortSignal.timeout(path.endsWith('/cloud-ai/test') ? 70000 : path.endsWith('/draft') ? 30000 : 12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a ação.');
  return result;
}

function DiscordMark() {
  return <svg width="22" height="18" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true"><path d="M104.4 8.87A102.2 102.2 0 0 0 79.05.92a70.35 70.35 0 0 0-3.24 6.71 95.12 95.12 0 0 0-28.48 0A71.39 71.39 0 0 0 44.1.92 102.3 102.3 0 0 0 18.7 8.89C2.64 32.66-1.7 55.85.48 78.71a102.74 102.74 0 0 0 31.07 15.68c2.5-3.4 4.73-7 6.64-10.8a66.92 66.92 0 0 1-10.45-5.04c.88-.64 1.73-1.3 2.56-1.97 20.15 9.43 42 9.43 61.91 0 .83.68 1.68 1.34 2.56 1.98a66.28 66.28 0 0 1-10.47 5.06 87.25 87.25 0 0 0 6.64 10.79 102.35 102.35 0 0 0 31.09-15.67c2.58-26.5-4.41-49.48-18.22-69.83ZM42.45 64.67c-6.05 0-11.02-5.57-11.02-12.4s4.87-12.4 11.02-12.4c6.2 0 11.12 5.62 11.02 12.4 0 6.83-4.87 12.4-11.02 12.4Zm42.24 0c-6.05 0-11.02-5.57-11.02-12.4s4.87-12.4 11.02-12.4c6.2 0 11.12 5.62 11.02 12.4 0 6.83-4.87 12.4-11.02 12.4Z"/></svg>;
}

function Login({ theme = 'dark' }) {
  const [appId, setAppId] = useState(new URLSearchParams(window.location.search).get('app') || '');
  const valid = /^\d{15,22}$/.test(appId);
  return <main className="portal-login" data-theme={theme}><div className="portal-login-shell">
    <div className="portal-login-copy"><Brand/><div className="portal-login-content">
      <h1>Tudo o que é seu,<br/>em um <em>só lugar.</em></h1>
      <p>Entre com sua conta Discord para acessar todas as aplicações vinculadas a você.</p>
      <a className="portal-login-button" href="/api/auth/portal"><DiscordMark/>Continuar com Discord <Icon name="arrow" size={17}/></a>
      <a className="portal-plans-link" href="/plans">Conhecer bots e planos<Icon name="external" size={15}/></a>
      <div className="portal-login-reassurance"><Icon name="shield" size={16}/> Autenticação oficial do Discord. Seus dados ficam protegidos.</div>
    </div><div className="portal-login-compat"><details><summary>Usar acesso de uma aplicação já configurada</summary>
      <label htmlFor="portal-app-id">ID da aplicação</label>
      <div><input id="portal-app-id" inputMode="numeric" autoComplete="off" value={appId} onChange={event => setAppId(event.target.value.trim())} placeholder="ID da aplicação Discord"/>
      <a href={valid ? `/api/auth/portal/${appId}` : undefined} aria-disabled={!valid} onClick={event => { if (!valid) event.preventDefault(); }}>Entrar</a></div>
    </details></div></div>
    <LoginVisual/>
  </div><p className="portal-powered">Cloud · OAuth2 oficial do Discord</p></main>;
}

function Empty({ title, text }) { return <div className="portal-empty"><div className="portal-empty-symbol"><Icon name="apps" size={26}/></div><h3>{title}</h3><p>{text}</p></div>; }
function Field({ label, value, onChange, type = 'text', placeholder = '', hint = '', ...rest }) {
  return <label className="portal-field"><span>{label}</span><input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} {...rest} />{hint && <small>{hint}</small>}</label>;
}
function Section({ eyebrow, title, description, children, action }) {
  return <section className="portal-section"><div className="portal-section-head"><div><span className="portal-overline">{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>;
}
const appStatus = { active: 'Plano ativo', suspended: 'Acesso suspenso', expired: 'Plano vencido', unknown: 'Status não informado' };
const appProfile = { sales: 'Bot de Vendas', robux: 'Bot de Robux', other: 'Aplicação' };
function expiryLabel(value) {
  if (!value) return 'Vencimento não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vencimento não informado';
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'Plano vencido';
  return days === 1 ? 'Vence amanhã' : `Vence em ${days} dias`;
}
function ownedApps(session) {
  const cloud = session?.apps || [];
  const managed = session?.managedApps || [];
  const matched = new Set();
  const combined = managed.map(item => {
    const tenant = cloud.find(app => app.id === item.bot_id || app.id === item.manager_app_id);
    if (tenant) matched.add(tenant.id);
    return { id: item.manager_app_id, label: displayName(item.label), cloudId: tenant?.id || null,
      profile: item.profile, status: item.status, expiresAt: item.expires_at,
      botId: item.bot_id, source: 'manager' };
  });
  for (const item of cloud) if (!matched.has(item.id)) combined.push({ id: item.id, label: displayName(item.label),
    cloudId: item.id, profile: 'other', status: 'unknown', expiresAt: null, source: 'cloud' });
  return combined;
}

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [tab, setTab] = useState(() => nav.some(item => item[0] === window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'overview');
  const [preferences, setPreferences] = useState(() => { try { return readPreferences(window.localStorage); } catch { return normalizePreferences(); } });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolvedTheme = preferences.theme === 'system' ? (systemDark ? 'dark' : 'light') : preferences.theme;
  useEffect(() => { const media = window.matchMedia('(prefers-color-scheme: dark)'); const changed = e => setSystemDark(e.matches); media.addEventListener('change', changed); return () => media.removeEventListener('change', changed); }, []);
  useEffect(() => { const keys = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(value => !value); } }; window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys); }, []);
  const updatePreferences = patch => setPreferences(current => normalizePreferences({ ...current, ...patch }));
  useEffect(() => { try { localStorage.setItem('cloud.preferences.v1', JSON.stringify(preferences)); } catch {} }, [preferences]);
  useEffect(() => { if(window.location.hash!==`#${tab}`) window.history.pushState(null, '', `#${tab}`); window.scrollTo(0,0); }, [tab]);
  useEffect(() => { const changed = () => { const next = window.location.hash.slice(1)||'overview'; if (nav.some(item => item[0] === next)) setTab(next); }; window.addEventListener('hashchange', changed); return () => window.removeEventListener('hashchange', changed); }, []);
  const [appId, setAppId] = useState('');
  const [config, setConfig] = useState(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const appRef = useRef(appId); appRef.current = appId;
  const [createdLinks, setCreatedLinks] = useState([]);
  const [gifts, setGifts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState('');
  const [giftForm, setGiftForm] = useState({ name: '', title: '', description: '', memberLimit: '100', maxUses: '', expiresDays: '', count: '1', banner: '' });
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const escape = event => { if (event.key === 'Escape') setMenuOpen(false); }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);
  useEffect(() => { if (!menuOpen && !commandOpen) return; const before = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = before; }; }, [menuOpen, commandOpen]);
  const [managedDetail, setManagedDetail] = useState('');
  const [catalog, setCatalog] = useState({ plans: [], officialInvite: null });

  useEffect(() => { request('/me').then(data => { setSession(data); setAppId(data.apps?.[0]?.id || ''); }).catch(err => { if (!/Entre novamente/.test(err.message)) setError(err.message); }).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/catalog', { signal: controller.signal }).then(response => response.ok ? response.json() : null)
      .then(data => { if (data) setCatalog({ plans: data.plans || [], officialInvite: safeInvite(data.officialInvite) }); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!session || !appId) return;
    let cancelled = false;
    setConfig(null); setGifts([]); setLogs([]); setSecret(''); setCreatedLinks([]);
    Promise.allSettled([request(`/apps/${appId}/config`), request(`/apps/${appId}/gifts`), request(`/apps/${appId}/logs`)])
      .then(([c, g, l]) => { if (!cancelled) {
        if (c.status === 'fulfilled') setConfig(c.value);
        if (g.status === 'fulfilled') setGifts(g.value.gifts || []);
        if (l.status === 'fulfilled') setLogs(l.value.logs || []);
        const failed = [c, g, l].find(result => result.status === 'rejected');
        if (failed) setError(failed.reason?.message || 'Parte dos dados não foi carregada. Atualize para tentar novamente.');
      } })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [session, appId, detailRefresh]);
  const app = session?.apps?.find(item => item.id === appId);
  const visibleApps = ownedApps(session);
  const expiringApps = visibleApps.filter(item => item.source === 'manager' && item.expiresAt &&
    new Date(item.expiresAt).getTime() - Date.now() <= 7 * 86400000);
  const matchingApps = filterApps(visibleApps, query, statusFilter, preferences.sort).filter(item => !favoritesOnly || preferences.favorites.includes(`${item.source}:${item.id}`));
  const toggleFavorite = item => setPreferences(current => { const id = `${item.source}:${item.id}`; return normalizePreferences({ ...current, favorites: current.favorites.includes(id) ? current.favorites.filter(value => value !== id) : [...current.favorites, id] }); });
  const selectedManaged = visibleApps.find(item => item.id === managedDetail);
  const openApp = item => { if (saving) return; if (item.cloudId) { setAppId(item.cloudId); setTab('cloud'); } else { setManagedDetail(item.id); setTab('apps'); } setMenuOpen(false); };
  const call = (path, options = {}) => request(`/apps/${appId}${path}`, { ...options, csrf: session.csrf });
  const saveConfig = async data => {
    setSaving(true); setError(''); setFlash('');
    try { const target = appId; await call('/config', { method: 'PUT', data }); const updated = await call('/config'); if (appRef.current === target) { setConfig(updated); setSecret(''); setFlash('Configuração salva com sucesso.'); } }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const createGift = async event => {
    event.preventDefault(); setSaving(true); setError(''); setFlash('');
    try {
      const count = Number(giftForm.count || 1);
      const days = giftForm.expiresDays ? Number(giftForm.expiresDays) : null;
      const members = Number(giftForm.memberLimit);
      if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('Gere de 1 a 10 Gifts por vez.');
      if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) throw new Error('A validade deve ser de 1 a 3650 dias.');
      if (!Number.isInteger(members) || members < 1 || members > 500) throw new Error('O limite de membros deve ser de 1 a 500.');
      const { expiresDays, count: _count, ...fields } = giftForm;
      const data = { ...fields, memberLimit: members, maxUses: giftForm.maxUses ? Number(giftForm.maxUses) : null,
        expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null };
      const links = [];
      let batchError = null;
      for (let index = 0; index < count; index++) {
        try {
          const created = await call('/gifts', { method: 'POST', data: { ...data, name: count > 1 ? `${data.name} ${index + 1}` : data.name } });
          links.push(created.link);
        } catch (err) { batchError = err; break; }
      }
      const listing = await call('/gifts'); setGifts(listing.gifts || []);
      if (links.length) {
        setCreatedLinks(links);
        setGiftForm({ name: '', title: '', description: '', memberLimit: '100', maxUses: '', expiresDays: '', count: '1', banner: '' });
        await navigator.clipboard?.writeText(links.join('\n')).catch(() => {});
        setFlash(`${links.length} de ${count} Gift(s) criado(s). Links copiados se o navegador permitiu.`);
      }
      if (batchError) setError(`O lote parou após ${links.length} Gift(s): ${batchError.message}`);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const toggleGift = async gift => {
    if (gift.active && !window.confirm(`Desativar o Gift “${gift.name}”?`)) return;
    setSaving(true); setError('');
    try { await call(`/gifts/${gift.id}`, { method: 'PATCH', data: { active: !gift.active } });
      const listing = await call('/gifts'); setGifts(listing.gifts || []); setFlash('Gift atualizado.'); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const resetTheme = async () => {
    if (!window.confirm('Restaurar somente a aparência padrão desta aplicação?')) return;
    setSaving(true); setError('');
    try { await call('/theme/reset', { method: 'POST' }); setConfig(await call('/config')); setFlash('Aparência restaurada. OAuth e Gifts foram preservados.'); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  const logout = async () => { try { await request('/logout', { method: 'POST', csrf: session.csrf }); window.location.assign('/dashboard'); } catch (error) { setError('Não consegui encerrar a sessão. Tente sair novamente.'); } };
  const copyText = async text => { try { if (!navigator.clipboard) throw Error(); await navigator.clipboard.writeText(text); setFlash('Copiado para a área de transferência.'); } catch { setError('O navegador não permitiu copiar. Selecione o texto e copie manualmente.'); } };
  const openPreview = async (mode = '') => { const popup = window.open('', '_blank'); if (!popup) { setError('Permita pop-ups para abrir a prévia.'); return; } popup.opener = null; try { const result = await call('/preview', { method: 'POST' }); const url = new URL(result.link, window.location.origin); if (url.protocol !== 'https:' && url.origin !== window.location.origin) throw new Error('Link de prévia inválido.'); if(mode==='loading')url.searchParams.set('loading','1'); popup.location.href = url.href; } catch (error) { popup.close(); setError(error.message); } };
  const refreshApps = async () => { setRefreshing(true); setError(''); try { const data = await request('/me'); setSession(data); if (!data.apps?.some(item => item.id === appId)) { setAppId(data.apps?.[0]?.id || ''); setConfig(null); setGifts([]); setLogs([]); } setDetailRefresh(value => value + 1); setFlash('Aplicações atualizadas.'); } catch (err) { setError(err.message); } finally { setRefreshing(false); } };

  if (loading) return <div className="portal-loading" role="status">Carregando seu painel…</div>;
  if (!session) return <Login theme={resolvedTheme}/>;
  const count = visibleApps.length;
  return <div className={`portal-app ${tab==='chat'?'support-active':''} cloud-density-${preferences.density} ${preferences.reducedMotion ? 'cloud-reduce-motion' : ''}`} data-theme={resolvedTheme}>{menuOpen && <button className="portal-menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)}/>}<aside id="workspace-navigation" className={`portal-sidebar${menuOpen ? ' open' : ''}`}>
    <Brand/>
    <span className="portal-sidebar-label">WORKSPACE</span>
    <div className="portal-app-select"><span>Cloud da aplicação</span><select aria-label="Aplicação atual" value={appId} onChange={e => { setAppId(e.target.value); setTab('overview'); }} disabled={saving || !session.apps?.length}>
      {!session.apps?.length && <option value="">Nenhum bot configurado</option>}
      {session.apps?.map(item => <option key={item.id} value={item.id}>{displayName(item.label)}{!preferences.hideIds && ` · ${item.id.slice(-4)}`}</option>)}</select></div>
    <nav aria-label="Navegação do painel">{nav.filter(([key])=>key!=='platform'||session.isPlatformAdmin).map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'active' : ''}
      onClick={() => { setTab(key); setFlash(''); setMenuOpen(false); }}><Icon name={key==='cloud'?'shield':key}/><span>{label}</span></button>)}</nav>
    <a className="portal-sidebar-plans" href="/plans"><Icon name="subscriptions"/>Conhecer os planos<Icon name="external" size={14}/></a>
    <div className="portal-sidebar-bottom"><div className="portal-user">{session.user.avatar ? <img src={session.user.avatar} alt=""/> : <span>{session.user.name.slice(0, 1).toUpperCase()}</span>}
      <div><strong>{session.user.name}</strong><small>Discord conectado</small></div></div><button onClick={logout}><Icon name="logout" size={16}/>Sair da conta</button></div>
  </aside><div className="portal-main"><header className="portal-header"><button className="portal-menu" aria-label="Abrir menu" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" size={22}/></button>
      <div className="portal-header-trail">Painel <span>/</span> {nav.find(item => item[0] === tab)?.[1]}</div><div className="portal-header-right"><button className="command-trigger" onClick={() => setCommandOpen(true)}><Icon name="search" size={16}/><span>Buscar no workspace</span><kbd>Ctrl K</kbd></button><NotificationCenter request={request} csrf={session.csrf} planApps={expiringApps} openPlan={item => {setManagedDetail(item.id);setTab('subscriptions');}}/>{session.user.avatar ? <img src={session.user.avatar} alt=""/> : <span className="portal-header-initial">{session.user.name.slice(0,1)}</span>}</div></header>
    <main className="portal-content"><div className="portal-heading"><div><span className="portal-overline">SEU WORKSPACE</span><h1>{tab === 'overview' ? `Olá, ${session.user.name.split(' ')[0]}.` : nav.find(item => item[0] === tab)?.[1]}</h1>
      <p>{tab === 'overview' ? 'Gerencie suas aplicações vinculadas ao Discord.' : app ? `${displayName(app.label)}${preferences.hideIds ? '' : ` · ${app.id}`}` : 'Nenhuma aplicação vinculada.'}</p></div><button className="portal-outline heading-refresh" disabled={refreshing} onClick={refreshApps}><Icon name="refresh" className={refreshing?'spinning':''}/><span>{refreshing?'Atualizando…':'Atualizar dados'}</span></button></div>
      {error && <div className="portal-alert error" role="alert">{error}<button className="cloud-error-retry" onClick={() => { setError(''); setDetailRefresh(value => value + 1); }}>Tentar novamente</button><button onClick={() => setError('')} aria-label="Fechar aviso"><Icon name="close" size={16}/></button></div>}
      {flash && <div className="portal-alert" role="status">{flash}<button onClick={() => setFlash('')} aria-label="Fechar aviso"><Icon name="close" size={16}/></button></div>}
      {tab === 'overview' && preferences.expiryNotice && expiringApps.length > 0 && <div className="portal-expiry-notice" role="status"><Icon name="clock" size={20}/><div><strong>Confira seus planos</strong><p>{expiringApps.map(item => `${item.label}: ${expiryLabel(item.expiresAt)}`).join(' · ')}</p></div><button onClick={() => setTab('subscriptions')}>Ver planos<Icon name="arrow" size={15}/></button></div>}
      {tab === 'overview' && <><div className="cloud-overview-label"><span>WORKSPACE PESSOAL</span><span>APLICAÇÕES E COMUNIDADE</span></div><div className="portal-stats"><button onClick={() => setTab('apps')}><span className="portal-stat-icon"><Icon name="apps" size={23}/></span><span className="portal-stat-copy"><span>Aplicações vinculadas</span><strong>{count}</strong><small>Na sua conta Discord</small></span><span className="portal-stat-arrow"><Icon name="right" size={18}/></span></button><button onClick={() => setTab('logs')}><span className="portal-stat-icon"><Icon name="shield" size={22}/></span><span className="portal-stat-copy"><span>Verificações</span><strong>{config?.verified ?? '—'}</strong><small>{app ? `Em ${app.label}` : 'Selecione uma aplicação'}</small></span><span className="portal-stat-arrow"><Icon name="right" size={18}/></span></button><button onClick={() => setTab('cloud')}><span className="portal-stat-icon"><Icon name="shield" size={22}/></span><span className="portal-stat-copy"><span>Status do Cloud</span><strong className="portal-stat-status">{config ? config.secretConfigured ? 'Configurado' : 'Pendente' : '—'}</strong><small>{config?.secretConfigured ? 'OAuth2 cadastrado' : 'Confira a autenticação'}</small></span><span className="portal-stat-arrow"><Icon name="right" size={18}/></span></button></div>
        {app&&<section className="overview-finance"><div className="finance-section-head"><div><span className="portal-overline">SUA LOJA</span><h2>Rendimentos em um olhar</h2></div></div><FinancePanel key={appId} appId={appId} request={request} compact open={()=>setTab('finance')}/></section>}{app && <SetupChecklist config={config} open={setTab}/>}<div className="cloud-quick-actions">{[['products','Produtos','Crie e edite seu catálogo','products'],['verification','Verificação','Conecte sua comunidade','shield'],['gifts','Gifts','Crie links de recuperação','gifts'],['appearance','Aparência','Dê a sua identidade','appearance']].map(([key,label,description,icon])=><button key={key} onClick={()=>setTab(key)}><span className="quick-icon"><Icon name={icon} size={20}/></span><span><strong>{label}</strong><small>{description}</small></span><Icon name="arrow" size={17}/></button>)}</div><Section eyebrow="SUAS APLICAÇÕES" title="Suas aplicações" description="Todas as aplicações vinculadas à sua conta Discord." action={<button className="portal-outline" onClick={()=>setTab('apps')}><Icon name="apps" size={16}/>Ver todas<Icon name="arrow" size={15}/></button>}>
          {count ? <ApplicationGrid apps={filterApps(visibleApps,'','all',preferences.sort)} open={openApp} preferences={preferences} toggleFavorite={toggleFavorite} profileLabels={appProfile} statusLabels={appStatus} limit={4}/> : <Empty title="Nenhuma aplicação vinculada" text="Abra /painel → Cloud no seu bot e vincule sua conta Discord como proprietária. Depois atualize a lista."/>}</Section></>}
      {tab === 'apps' && <Section eyebrow="APLICAÇÕES" title="Seus bots" description="Dados do Cloud compartilhado, vinculados à identidade autorizada no Discord.">
        <AppToolbar query={query} setQuery={setQuery} status={statusFilter} setStatus={setStatusFilter} preferences={preferences} update={updatePreferences} favoritesOnly={favoritesOnly} setFavoritesOnly={setFavoritesOnly}/><p className="cloud-result-count">{matchingApps.length} de {count} aplicação(ões)</p>{matchingApps.length ? <><ApplicationGrid apps={matchingApps} open={openApp} preferences={preferences} toggleFavorite={toggleFavorite} profileLabels={appProfile} statusLabels={appStatus}/>
          {selectedManaged && !selectedManaged.cloudId && <div className="portal-managed-detail"><h3>{selectedManaged.label}</h3><dl><div><dt>Aplicação</dt><dd>{preferences.hideIds ? 'ID oculto' : selectedManaged.id}<button className="cloud-icon-button" aria-label="Copiar ID da aplicação" onClick={()=>copyText(selectedManaged.id)}><Icon name="copy" size={15}/></button></dd></div><div><dt>Produto</dt><dd>{appProfile[selectedManaged.profile]}</dd></div><div><dt>Plano</dt><dd>{appStatus[selectedManaged.status] || appStatus.unknown}</dd></div><div><dt>Vencimento</dt><dd>{selectedManaged.expiresAt ? formatDate(selectedManaged.expiresAt,preferences.timezone) : 'Não informado'}</dd></div></dl><p>Para renovar o plano ou configurar o bot, use o servidor oficial no Discord. O Cloud aparece aqui quando for vinculado no /painel do bot.</p></div>}</> : <Empty title={count ? 'Nenhum resultado' : 'Sem aplicações'} text={count ? 'Tente outro nome, ID ou estado do plano.' : 'A vinculação depende do proprietário salvo no Manager ou no Cloud de cada bot.'}/>}</Section>}
      {tab === 'verification' && <Section eyebrow="VERIFICAÇÃO" title="Acesso ao servidor" description="O botão publicado pelo bot cria uma autorização individual no Discord para cada pessoa.">
        {config ? <div className="portal-verification-grid"><div className="portal-verification-card"><span className="portal-overline">ESTADO ATUAL</span><h3>{config.secretConfigured && config.guildId ? 'Pronta para publicar' : 'Configuração pendente'}</h3><p>{config.secretConfigured && config.guildId ? 'Publique ou atualize o botão pelo /painel → Cloud → Autenticação no servidor principal.' : 'Cadastre o Client Secret e o servidor principal para ativar a verificação.'}</p><dl><div><dt>Contas verificadas</dt><dd>{config.verified ?? '—'}</dd></div><div><dt>Servidor principal</dt><dd>{config.guildId || 'Não definido'}</dd></div><div><dt>Cargo automático</dt><dd>{config.roleId || 'Não definido'}</dd></div><div><dt>Canal publicado</dt><dd>{config.verifyChannelId || 'Ainda não publicado'}</dd></div></dl><div className="portal-actions"><button className="portal-primary" onClick={() => setTab('cloud')}>Configurar OAuth2<Icon name="arrow" size={16}/></button><button className="portal-outline" onClick={() => setTab('appearance')}>Personalizar página</button></div></div><div className="portal-verification-aside"><span>COMO A PESSOA VÊ</span><strong>Verificar → Autorizar no Discord → Resultado</strong><p>A tela oficial mostra as permissões antes de qualquer acesso. Após autorizar, a pessoa chega à página de conclusão com a aparência da sua aplicação.</p><button onClick={openPreview}>Abrir prévia da página<Icon name="external" size={16}/></button></div></div> : <Empty title="Escolha uma aplicação" text="Selecione um bot vinculado para ver a verificação."/>}</Section>}
      {tab === 'subscriptions' && <Section eyebrow="PLANOS" title="Planos e renovação" description="Consulte o prazo de cada bot. A compra e a renovação acontecem no servidor oficial no Discord.">
        {visibleApps.some(item => item.source === 'manager') ? <div className="portal-subscription-list">{visibleApps.filter(item => item.source === 'manager').map(item => <article key={item.id}><span className="portal-app-icon">{item.label.slice(0, 1).toUpperCase()}</span><div><h3>{item.label}</h3><p>{appProfile[item.profile]} · {appStatus[item.status] || appStatus.unknown}</p><strong>{expiryLabel(item.expiresAt)}</strong><small>{item.expiresAt && !Number.isNaN(new Date(item.expiresAt).getTime()) ? formatDate(item.expiresAt,preferences.timezone) : 'Data ainda não enviada pelo Manager'}</small></div></article>)}</div> : <Empty title="Nenhum plano vinculado" text="Os planos aparecem quando o Manager sincroniza os bots da sua conta Discord."/>}
        <div className="portal-subscription-actions"><a className="portal-primary" href="/plans">Comparar planos<Icon name="arrow" size={16}/></a>{catalog.officialInvite ? <a className="portal-outline" href={catalog.officialInvite} target="_blank" rel="noopener noreferrer">Comprar ou renovar no Discord<Icon name="external" size={16}/></a> : <span>O convite oficial aparecerá após ser configurado no Manager.</span>}</div></Section>}
      {tab === 'cloud' && <Section eyebrow="CLOUD" title="Autenticação Discord" description="O Client Secret permanece somente no backend. O formulário nunca mostra o valor salvo.">
        {config ? <form className="portal-form" onSubmit={event => { event.preventDefault(); saveConfig({ label: config.label, clientId: config.clientId || appId,
          clientSecret: secret || undefined, guildId: config.guildId || null, backupGuildId: config.backupGuildId || null,
          roleId: config.roleId || null, logChannelId: config.logChannelId || null }); }}>
          <div className="portal-keyline"><span>REDIRECT URI PARA O DISCORD DEVELOPER PORTAL</span><code>{config.redirectUri}</code><button type="button" onClick={() => copyText(config.redirectUri)}><Icon name="copy" size={15}/>Copiar</button></div>
          <p className="portal-help">Cadastre esta URL exatamente em OAuth2 → Redirects da aplicação Discord. Ao trocar o domínio, atualize também esse campo no Developer Portal.</p>
          <div className="portal-fields"><Field label="Nome da loja" value={config.label} onChange={value => setConfig({ ...config, label: value })}/>
            <Field label="Client ID" value={config.clientId || appId} onChange={value => setConfig({ ...config, clientId: value })}/>
            <Field label={`Client Secret · ${config.secretConfigured ? 'salvo' : 'não configurado'}`} type="password" value={secret} onChange={setSecret} placeholder={config.secretConfigured ? 'Deixe em branco para manter' : 'Insira o segredo da aplicação'}/>
            {['guildId', 'backupGuildId', 'roleId', 'logChannelId'].map((key, i) => <Field key={key} label={['Servidor principal · ID', 'Servidor de backup · ID', 'Cargo após verificar · ID', 'Canal de logs · ID'][i]}
              value={config[key] || ''} onChange={value => setConfig({ ...config, [key]: value })} inputMode="numeric" />)}</div>
          <button className="portal-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar autenticação'}</button></form> : <Empty title="Carregando autenticação" text="Aguarde a consulta ao backend."/>}</Section>}
      {tab === 'gifts' && <Section eyebrow="GIFTS" title="Seu estúdio de links" description="Crie lotes, personalize o convite e acompanhe cada Gift.">{app?<GiftStudio key={appId} gifts={gifts} call={call} setGifts={setGifts}/>:<Empty title="Escolha uma aplicação" text="Vincule um bot para gerenciar seus Gifts."/>}</Section>}
      {tab === 'finance' && <Section eyebrow="SUA OPERAÇÃO" title="Rendimentos com todos os detalhes" description="Vendas confirmadas, evolução e histórico financeiro da aplicação.">{app?<FinancePanel key={appId} appId={appId} request={request}/>:<Empty title="Escolha uma aplicação" text="Selecione um bot vinculado para consultar os rendimentos."/>}</Section>}
      {tab === 'platform' && session.isPlatformAdmin && <Section eyebrow="ADMINISTRAÇÃO DO PROJETO" title="Controle da operação" description="Bots, servidores, gateway e atendimento no próprio site."><PlatformAdmin request={request} csrf={session.csrf}/></Section>}
      {tab === 'ai' && <Section eyebrow="INTELIGÊNCIA ARTIFICIAL" title="Conhecimento que atende" description="Conecte sua API, personalize a voz da loja e prepare respostas com a equipe.">{app?<AISettings key={appId} appId={appId} request={request} csrf={session.csrf}/>:<Empty title="Escolha uma aplicação" text="Selecione um bot vinculado para configurar a IA."/>}</Section>}
      {tab === 'tickets' && <Section eyebrow="TICKETS DE CLIENTES" title="Sua operação de atendimento" description="Acompanhe o Discord e responda pelo site com a identidade da sua loja.">{app?<TicketInbox key={appId} appId={appId} request={request} csrf={session.csrf}/>:<Empty title="Escolha uma aplicação" text="Selecione um bot para consultar os tickets da loja."/>}</Section>}
      {tab === 'ticket-settings' && <Section eyebrow="PREFERÊNCIAS DE ATENDIMENTO" title="Do seu jeito, em cada resposta" description="Escolha bot ou webhook, personalize a apresentação e organize respostas rápidas.">{app?<TicketSettings key={appId} appId={appId} request={request} csrf={session.csrf}/>:<Empty title="Escolha uma aplicação" text="Selecione um bot para configurar o atendimento."/>}</Section>}
      {tab === 'chat' && <Section eyebrow="ATENDIMENTO" title="Sua equipe, por perto" description="Veja seus tickets, confira as respostas e abra a conversa com a equipe.">{app?<SupportWorkspace key={appId} appId={appId} request={request} csrf={session.csrf} applicationName={app.label}/>:<Empty title="Escolha uma aplicação" text="Selecione um bot vinculado para iniciar uma conversa."/>}</Section>}
      {tab === 'products' && <Section eyebrow="SUA LOJA" title="Sua loja conectada ao bot" description="Gerencie produtos no Sallers ou tarifas, estoque e visuais no Buxx. As mudanças precisam ser confirmadas pelo bot.">{app?<ProductsPanel key={appId} appId={appId} request={request} csrf={session.csrf}/>:<Empty title="Escolha uma aplicação" text="Selecione um bot com Cloud vinculado para gerenciar produtos."/>}</Section>}
      {tab === 'appearance' && <Section eyebrow="APARÊNCIA" title="Sua página, sua identidade" description="As cores e textos são isolados por aplicação. A prévia não consome Gift.">
        {config?.theme ? <form className="portal-form" onSubmit={event => { event.preventDefault(); saveConfig({ theme: config.theme }); }}><div className="cloud-appearance-tools"><div><h3>Comece por uma paleta</h3><p>Aplique, ajuste e salve quando estiver satisfeito.</p></div><div className="cloud-swatches">{Object.entries(PUBLIC_PRESETS).map(([key, colors]) => <button key={key} type="button" onClick={() => setConfig({ ...config, theme: { ...config.theme, ...colors } })}><Icon name={key==='light'?'sun':'moon'} size={16}/>{({ dark:'Escuro',light:'Claro',contrast:'Alto contraste',red:'Vermelho',blue:'Azul',purple:'Violeta',green:'Esmeralda' })[key]}</button>)}</div></div><label className="cloud-radius">Arredondamento dos cards <input type="range" min="4" max="32" value={config.theme.radius ?? 22} onChange={e => setConfig({ ...config, theme: { ...config.theme, radius: Number(e.target.value) } })}/><span>{config.theme.radius ?? 22}px</span></label><div className="portal-fields">
          {['name', 'title', 'description', 'logo', 'banner', 'backgroundImage', 'loadingTitle', 'loadingDescription', 'loadingBackgroundImage', 'button', 'footer'].map(key => <Field key={key} label={{ name: 'Nome da loja', title: 'Título', description: 'Descrição', logo: 'Logo HTTPS', banner: 'Banner HTTPS', backgroundImage: 'Fundo da página HTTPS', loadingTitle: 'Título do carregamento', loadingDescription: 'Descrição do carregamento', loadingBackgroundImage: 'Fundo do carregamento HTTPS', button: 'Texto do botão', footer: 'Rodapé' }[key]}
            value={config.theme[key]} onChange={value => setConfig({ ...config, theme: { ...config.theme, [key]: value } })}/>)}
          {['primary', 'secondary', 'text', 'background', 'card', 'border'].map(key => <Field key={key} label={{ primary: 'Cor principal', secondary: 'Cor secundária', text: 'Texto', background: 'Fundo', card: 'Card', border: 'Borda' }[key]}
            type="color" value={config.theme[key] || '#101010'} onChange={value => setConfig({ ...config, theme: { ...config.theme, [key]: value } })}/>)}</div>
          <VerificationAppearance theme={config.theme} update={patch=>setConfig({...config,theme:{...config.theme,...patch}})} preview={()=>openPreview('loading')}/><div className="portal-actions"><button className="portal-primary" disabled={saving}>Salvar aparência</button><button type="button" className="portal-outline" disabled={saving} onClick={openPreview}>Abrir prévia<Icon name="external" size={16}/></button><button type="button" className="portal-text-danger" disabled={saving} onClick={resetTheme}>Resetar aparência</button></div></form>
          : <Empty title="Carregando aparência" text="Aguarde a consulta ao backend."/>}</Section>}
      {tab === 'logs' && <Section eyebrow="ATIVIDADE" title="Histórico do Cloud" description="Pesquise e exporte os eventos carregados da aplicação selecionada.">
        {app ? <ActivityPanel key={appId} logs={logs} timezone={preferences.timezone} onError={setError} refresh={async () => { const result = await call('/logs'); setLogs(result.logs || []); }}/>
          : <Empty title="Escolha uma aplicação" text="Selecione um bot vinculado para consultar sua atividade."/>}</Section>}
      {tab === 'preferences' && <Section eyebrow="SEU WORKSPACE" title="Um painel com a sua cara" description="Cores, organização e conforto visual, salvos neste navegador."><PreferencesPanel value={preferences} update={updatePreferences}/></Section>}
      {tab === 'help' && <Section eyebrow="CENTRAL DE AJUDA" title="O próximo passo, sem dúvidas." description="Orientações para aplicações, comunidade e conta."><HelpPanel invite={catalog.officialInvite}/></Section>}
    </main><footer className="portal-footer">Cloud <span>·</span> Conectado ao Discord <span>·</span> Dados separados por aplicação</footer></div>
  <nav className="mobile-nav" aria-label="Navegação rápida">{[['overview','Início','overview'],['apps','Apps','apps'],['products','Loja','products'],['finance','Receita','revenue']].map(([key,label,icon])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key);setMenuOpen(false)}}><Icon name={icon} size={20}/><span>{label}</span></button>)}<button aria-expanded={menuOpen} aria-label="Abrir menu completo" onClick={()=>setMenuOpen(value=>!value)}><Icon name="menu" size={20}/><span>Menu</span></button></nav>
  {commandOpen&&<CommandMenu apps={visibleApps} navigation={nav.filter(([key])=>key!=='platform'||session.isPlatformAdmin)} selectTab={setTab} openApp={openApp} close={()=>setCommandOpen(false)}/>}
  </div>;
}
