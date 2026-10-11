import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const DEFAULT_THEME = {
  name: 'Valtrex', title: 'Verifique sua conta', description: 'Conecte sua conta Discord para concluir a verificação.',
  primary: '#7968f8', secondary: '#a99eff', text: '#f6f5fb', background: '#08090d', card: '#161821',
  border: '#393c4e', radius: 22, button: 'Continuar com Discord', footer: 'ValtrexCloud',
};
const messages = {
  success: ['Verificação concluída', 'Sua conta Discord foi verificada. Se a loja configurou um cargo, ele será concedido em instantes.'],
  expired: ['Este convite expirou', 'Peça à loja um novo link de verificação.'],
  full: ['Limite atingido', 'Este convite não aceita mais verificações.'],
  invalid: ['Link indisponível', 'Confira se o endereço está completo ou solicite outro convite.'],
  cancelled: ['Autorização cancelada', 'Você pode tentar novamente quando quiser.'],
  oauth: ['Não foi possível conectar', 'Revise a autorização no Discord e tente novamente.'],
  incomplete: ['Configuração pendente', 'A loja ainda precisa terminar a configuração OAuth.'],
  busy: ['Muitas tentativas', 'Aguarde um minuto antes de tentar novamente.'],
  temporary: ['Erro temporário', 'Tente novamente em alguns instantes.'],
  forbidden: ['Acesso restrito', 'Somente o proprietário desta aplicação pode usar este Gift de recuperação.'],
};

function luminance(color) {
  const channels = [1, 3, 5].map(position => parseInt(color.slice(position, position + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first, second) {
  const a = luminance(first); const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function readableColor(preferred, background) {
  if (contrast(preferred, background) >= 4.5) return preferred;
  return contrast('#ffffff', background) >= contrast('#171821', background) ? '#ffffff' : '#171821';
}

function DiscordIcon() {
  return <svg width="22" height="18" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true"><path d="M104.4 8.87A102.2 102.2 0 0 0 79.05.92a70.35 70.35 0 0 0-3.24 6.71 95.12 95.12 0 0 0-28.48 0A71.39 71.39 0 0 0 44.1.92 102.3 102.3 0 0 0 18.7 8.89C2.64 32.66-1.7 55.85.48 78.71a102.74 102.74 0 0 0 31.07 15.68c2.5-3.4 4.73-7 6.64-10.8a66.92 66.92 0 0 1-10.45-5.04c.88-.64 1.73-1.3 2.56-1.97 20.15 9.43 42 9.43 61.91 0 .83.68 1.68 1.34 2.56 1.98a66.28 66.28 0 0 1-10.47 5.06 87.25 87.25 0 0 0 6.64 10.79 102.35 102.35 0 0 0 31.09-15.67c2.58-26.5-4.41-49.48-18.22-69.83ZM42.45 64.67c-6.05 0-11.02-5.57-11.02-12.4s4.87-12.4 11.02-12.4c6.2 0 11.12 5.62 11.02 12.4 0 6.83-4.87 12.4-11.02 12.4Zm42.24 0c-6.05 0-11.02-5.57-11.02-12.4s4.87-12.4 11.02-12.4c6.2 0 11.12 5.62 11.02 12.4 0 6.83-4.87 12.4-11.02 12.4Z"/></svg>;
}
function ShieldIcon() { return <svg width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>; }
function Brand({ theme = DEFAULT_THEME }) { return <div className="brand"><span className="brand-mark">V</span><span>{theme.name === DEFAULT_THEME.name ? 'ValtrexApplications' : theme.name}<small>VALTREXCLOUD · DISCORD OAUTH2</small></span></div>; }

function Shell({ children, theme = DEFAULT_THEME }) {
  const css = { '--primary': theme.primary, '--secondary': readableColor(theme.secondary, theme.card),
    '--text': readableColor(theme.text, theme.card), '--button-text': readableColor('#ffffff', theme.primary),
    '--muted-text': readableColor('#a8a9b9', theme.card),
    '--outside-text': readableColor('#a8a9b9', theme.background),
    '--background': theme.background, '--card': theme.card, '--border': theme.border,
    '--radius': `${theme.radius || 22}px`, '--wallpaper': theme.backgroundImage ? `url("${theme.backgroundImage}")` : 'none',
    '--overlay': luminance(theme.background) > 0.6
      ? 'linear-gradient(rgba(255,255,255,.15),rgba(255,255,255,.22))'
      : 'linear-gradient(180deg,rgba(5,6,10,.4),rgba(5,6,10,.8))' };
  return <div className="app" style={css}><div className="aurora aurora-a"/><div className="aurora aurora-b"/>
    <header className="topbar"><Brand theme={theme}/><span className="secure-label"><span className="secure-dot"/> Conexão segura</span></header>
    <main>{children}</main><footer>{theme.footer === DEFAULT_THEME.footer ? 'ValtrexApplications' : theme.footer} <span>·</span> OAuth2 oficial do Discord</footer>
  </div>;
}

function AccessPage({ token, kind = 'backup' }) {
  const [state, setState] = useState({ loading: true });
  const [leaving, setLeaving] = useState(false);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/${kind === 'verify' ? 'v' : 'g'}/${encodeURIComponent(token)}`, { signal: controller.signal, credentials: 'omit' })
      .then(async response => { const data = await response.json(); setState({ ...data, loading: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'temporary', loading: false }); });
    return () => controller.abort();
  }, [token, kind]);
  if (state.loading || leaving) return <LoadingPage text={leaving ? 'Abrindo autorização oficial do Discord…' : kind === 'verify' ? 'Preparando sua verificação…' : 'Preparando o Gift…'}/>;
  if (state.status !== 'active') return <StatusPage status={state.status} />;
  const theme = { ...DEFAULT_THEME, ...state.theme };
  const verify = kind === 'verify';
  return <Shell theme={theme}>
    <article className="card gift-card">
      {(state.banner || theme.banner) ? <img className="banner" src={state.banner || theme.banner} alt="Banner da loja" onError={e => { e.currentTarget.hidden = true; }} /> : <div className="banner-gradient" aria-hidden="true"><span>VALTREX<span className="accent">CLOUD</span></span></div>}
      <div className="card-body">
        {theme.logo ? <img className="store-logo" src={theme.logo} alt={`Logo de ${state.store}`} onError={e => { e.currentTarget.hidden = true; }} /> : <div className="store-logo store-logo-fallback" aria-hidden="true">V</div>}
        <div className="eyebrow"><ShieldIcon/> {verify ? 'VERIFICAÇÃO DO SERVIDOR' : 'GIFT DE RECUPERAÇÃO'}</div>
        <h1>{verify ? theme.title : state.title || 'Proteja sua comunidade'}</h1>
        <p className="lead">{verify ? theme.description : state.description || 'Faça login para preparar a recuperação de membros que consentiram com esta finalidade.'}</p>
        <div className="divider"/>
        <div className="steps"><span className="step-number">01</span><div><strong>Entre pelo Discord</strong><p>Você verá as permissões no domínio oficial discord.com.</p></div></div>
        <div className="steps"><span className="step-number">02</span><div><strong>{verify ? 'Confirme sua conta' : 'Escolha o servidor de destino'}</strong><p>{verify ? 'A loja poderá conceder o cargo configurado. Você também autoriza a recuperação da comunidade via guilds.join.' : 'Depois do login, adicione o bot e informe quantos membros autorizados deseja recuperar.'}</p></div></div>
        {verify && <label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>Concordo que esta loja guarde minha autorização OAuth protegida por até 90 dias para me incluir em um servidor de recuperação se necessário. Posso revogar o acesso em <strong>Discord › Aplicativos autorizados</strong>.</span></label>}
        <a className={`discord-button ${verify && !consent ? 'disabled-link' : ''}`} aria-disabled={verify && !consent} href={`/api/auth/${verify ? 'verify' : 'start'}/${encodeURIComponent(token)}`} onClick={event => { if (verify && !consent) { event.preventDefault(); return; } setLeaving(true); }}><DiscordIcon/>{verify ? theme.button || 'Verificar com Discord' : 'Entrar com Discord'}<span aria-hidden="true">↗</span></a>
        <p className="privacy">{verify ? 'Sua autorização é específica desta loja. A recuperação usa somente membros que consentiram.' : 'Somente o proprietário da aplicação pode iniciar a recuperação. Nenhum membro sem autorização será transferido.'} Nunca pedimos sua senha.</p>
      </div>
    </article>
    <p className="below-card"><span>◇</span> Verificação protegida para <strong>{state.store}</strong></p>
  </Shell>;
}

function LoadingPage({ text = 'Verificando sua conta…' }) {
  return <Shell><section className="card status-card loading-card" role="status" aria-live="polite">
    <div className="loading-orbit"><ShieldIcon/><i/><i/></div>
    <span className="eyebrow">CONEXÃO SEGURA · DISCORD OAUTH2</span><h1>{text}</h1>
    <p className="lead">Estamos conferindo sua autorização com segurança. Esta página nunca solicita senha ou token de conta.</p>
    <div className="loading-track"><span/></div>
  </section></Shell>;
}

function SetupPage({ token }) {
  const [state, setState] = useState({ loading: true });
  const [guildId, setGuildId] = useState('');
  const [count, setCount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/gift/${encodeURIComponent(token)}`, { credentials: 'same-origin', signal: controller.signal })
      .then(async response => { const data = await response.json(); setState(response.ok ? { ...data, loading: false } : { status: 'forbidden', loading: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'temporary', loading: false }); });
    return () => controller.abort();
  }, [token]);
  useEffect(() => {
    if (!job?.jobId) return;
    const poll = async () => {
      try { const response = await fetch(`/api/gift/${encodeURIComponent(token)}/job/${job.jobId}`, { credentials: 'same-origin' });
        if (response.ok) { const update = await response.json(); setJob(previous => ({ ...previous, ...update })); } } catch { /* tenta novamente */ }
    };
    poll(); const interval = setInterval(poll, 10000); return () => clearInterval(interval);
  }, [token, job?.jobId]);
  if (state.loading) return <LoadingPage text="Preparando sua recuperação…"/>;
  if (state.status) return <StatusPage status={state.status}/>;
  const invite = state.applicationId && guildId && /^\d{15,22}$/.test(guildId)
    ? `https://discord.com/oauth2/authorize?${new URLSearchParams({ client_id: state.applicationId, scope: 'bot applications.commands', permissions: '268435457', guild_id: guildId, disable_guild_select: 'true' })}` : '';
  const botPresent = state.botGuilds?.includes(guildId);
  async function submit(event) {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const response = await fetch(`/api/gift/${encodeURIComponent(token)}/recovery`, { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guildId, count: Number(count) }) });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Não foi possível iniciar.'); else setJob(data);
    } catch { setError('Conexão indisponível. Tente novamente.'); }
    finally { setSaving(false); }
  }
  return <Shell><section className="card setup-card">
    <div className="setup-head"><div className="status-icon"><ShieldIcon/></div><span className="eyebrow">GIFT · ACESSO DO PROPRIETÁRIO</span><h1>Recuperação da comunidade</h1>
      <p className="lead">Use somente membros que autorizaram explicitamente esta loja. O Discord pode recusar contas com autorização revogada ou restrições.</p></div>
    {job ? <div className="setup-form"><div className="stat"><span>Concluídos</span><strong>{job.joined ?? 0} / {job.requested}</strong></div>
      <div className="progress"><span style={{ width: `${Math.round(((job.joined || 0) + (job.failed || 0) + (job.skipped || 0)) / job.requested * 100)}%` }}/></div>
      <p className="lead">{job.status === 'completed' ? 'Recuperação concluída.' : job.status === 'partial' ? 'Recuperação parcial. Consulte os logs para os motivos.' : `${job.pending ?? job.requested} na fila.`} {job.skipped || 0} já estavam no servidor · {job.failed || 0} recusados.</p></div>
      : <form className="setup-form" onSubmit={submit}>
        <div className="stat"><span>Membros que consentiram</span><strong>{state.eligible}</strong></div>
        <label htmlFor="guild">Servidor de destino</label><select id="guild" value={guildId} onChange={e => setGuildId(e.target.value)} required>
          <option value="">Selecione um servidor que você administra</option>{state.guilds?.map(g => <option key={g.id} value={g.id}>{g.name} · {g.id}</option>)}
        </select>
        <label htmlFor="guild-id">ID do servidor</label><input id="guild-id" value={guildId} onChange={e => setGuildId(e.target.value.trim())} inputMode="numeric" pattern="[0-9]{15,22}" required placeholder="Cole o ID do servidor"/>
        {invite && <a className="subtle-button" href={invite} target="_blank" rel="noopener noreferrer">Adicionar bot pelo Discord ↗</a>}
        <p className="inline-note">{botPresent ? 'Bot conectado e com Criar Convite no servidor.' : 'Após adicionar o bot com Criar Convite, aguarde até um minuto e atualize a página.'}</p>
        <label htmlFor="count">Quantidade solicitada</label><input id="count" value={count} onChange={e => setCount(e.target.value)} type="number" min="1" max={Math.min(500, state.eligible)} required placeholder="Ex.: 100"/>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="discord-button" type="submit" disabled={saving || !botPresent || !state.eligible}>{saving ? 'Conferindo…' : 'Iniciar recuperação consentida'}<span aria-hidden="true">→</span></button>
        <p className="privacy">A contagem final mostra apenas as entradas aceitas pelo Discord. O limite por pedido é 500.</p>
      </form>}
  </section></Shell>;
}

function StatusPage({ status = 'invalid' }) {
  const [title, description] = messages[status] || messages.temporary;
  return <Shell><section className="card status-card" role="status" aria-live="polite">
    <div className={`status-icon ${status === 'success' ? 'success' : ''}`}>{status === 'success' ? '✓' : <ShieldIcon/>}</div>
    <span className="eyebrow">VALTREX CLOUD</span><h1>{title}</h1><p className="lead">{description}</p>
    <a href="/" className="subtle-button">Voltar ao início <span aria-hidden="true">→</span></a>
  </section></Shell>;
}
function PreviewPage({ parts }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/preview/${parts.join('/')}`, { signal: controller.signal, credentials: 'omit' })
      .then(async response => setState({ ...await response.json(), loading: false }))
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'temporary', loading: false }); });
    return () => controller.abort();
  }, [parts.join('/')]);
  if (state.loading) return <Shell><section className="card status-card" role="status">Carregando preview...</section></Shell>;
  if (state.status !== 'preview') return <StatusPage status="invalid"/>;
  const theme = { ...DEFAULT_THEME, ...state.theme };
  return <Shell theme={theme}><section className="card home-card"><span className="eyebrow">PRÉ-VISUALIZAÇÃO · NÃO CONSOME GIFT</span>
    <h1>{theme.title}</h1><p className="lead">{theme.description}</p>
    {theme.banner && <img className="preview-banner" src={theme.banner} alt="Banner da página" onError={e => { e.currentTarget.hidden = true; }}/>}
    <div className="discord-button preview-button"><DiscordIcon/>{theme.button}<span aria-hidden="true">↗</span></div>
    <p className="privacy">Prévia de {state.store}. O botão está desativado e não inicia OAuth.</p>
  </section></Shell>;
}

function Home() { return <Shell><section className="card home-card"><span className="eyebrow"><ShieldIcon/> VALTREXAPPLICATIONS</span><h1>Sua comunidade começa com confiança.</h1><p className="lead">A verificação usa um botão no servidor. Gifts abrem uma área separada de recuperação para o proprietário da aplicação.</p><div className="home-trust"><span>✦ Verificação por servidor</span><span>⌁ Recuperação consentida</span></div><div className="divider"/><div className="steps"><span className="step-number">01</span><div><strong>Abra o link da loja</strong><p>Use o botão Verificar no Discord ou o Gift de recuperação recebido do proprietário.</p></div></div><div className="steps"><span className="step-number">02</span><div><strong>Autorize no Discord</strong><p>Confira as permissões e confirme diretamente no site oficial.</p></div></div><div className="home-note"><ShieldIcon/><span>Seu login acontece no Discord. A ValtrexApplications nunca pede sua senha.</span></div></section></Shell>; }

const path = window.location.pathname;
const gift = path.match(/^\/g\/([A-Za-z0-9_-]+)$/);
const giftSetup = path.match(/^\/g\/([A-Za-z0-9_-]+)\/setup$/);
const verify = path.match(/^\/v\/(\d{15,22})$/);
const preview = path.match(/^\/preview\/(\d{15,22})\/(\d{13})\/([0-9a-f]{64})$/);
const status = new URLSearchParams(window.location.search).get('status');
createRoot(document.getElementById('root')).render(giftSetup ? <SetupPage token={giftSetup[1]}/> : gift ? <AccessPage token={gift[1]}/> : verify ? <AccessPage token={verify[1]} kind="verify"/> : preview ? <PreviewPage parts={preview.slice(1)}/> : path === '/result' ? <StatusPage status={status}/> : path === '/' ? <Home/> : <StatusPage status="invalid"/>);
