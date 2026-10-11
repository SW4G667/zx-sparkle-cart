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
function Brand({ theme = DEFAULT_THEME }) { return <div className="brand"><span className="brand-mark">V</span><span>{theme.name || 'Valtrex'}<small>CLOUD VERIFICATION</small></span></div>; }

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
    <main>{children}</main><footer>{theme.footer || 'ValtrexCloud'} <span>·</span> OAuth2 oficial do Discord</footer>
  </div>;
}

function GiftPage({ token }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/g/${encodeURIComponent(token)}`, { signal: controller.signal, credentials: 'omit' })
      .then(async response => { const data = await response.json(); setState({ ...data, loading: false }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'temporary', loading: false }); });
    return () => controller.abort();
  }, [token]);
  if (state.loading) return <Shell><section className="card status-card" role="status" aria-live="polite"><div className="loader"/><p>Carregando convite...</p></section></Shell>;
  if (state.status !== 'active') return <StatusPage status={state.status} />;
  const theme = { ...DEFAULT_THEME, ...state.theme };
  return <Shell theme={theme}>
    <article className="card gift-card">
      {(state.banner || theme.banner) ? <img className="banner" src={state.banner || theme.banner} alt="Banner da loja" onError={e => { e.currentTarget.hidden = true; }} /> : <div className="banner-gradient" aria-hidden="true"><span>VALTREX<span className="accent">CLOUD</span></span></div>}
      <div className="card-body">
        {theme.logo ? <img className="store-logo" src={theme.logo} alt={`Logo de ${state.store}`} onError={e => { e.currentTarget.hidden = true; }} /> : <div className="store-logo store-logo-fallback" aria-hidden="true">V</div>}
        <div className="eyebrow"><ShieldIcon/> VERIFICAÇÃO DE CONTA</div>
        <h1>{state.title || theme.title}</h1>
        <p className="lead">{state.description || theme.description}</p>
        <div className="divider"/>
        <div className="steps"><span className="step-number">01</span><div><strong>Autorize pelo Discord</strong><p>Você será levado ao site oficial do Discord para confirmar a identidade da sua conta.</p></div></div>
        <div className="steps"><span className="step-number">02</span><div><strong>Conclua a verificação</strong><p>Após autorizar, você voltará a esta página e verá o resultado.</p></div></div>
        <a className="discord-button" href={`/api/auth/start/${encodeURIComponent(token)}`}><DiscordIcon/>{theme.button || 'Continuar com Discord'}<span aria-hidden="true">↗</span></a>
        <p className="privacy">Usamos apenas seu ID público do Discord para esta verificação. Sua senha e seu token de conta não são solicitados.</p>
      </div>
    </article>
    <p className="below-card"><span>◇</span> Verificação protegida para <strong>{state.store}</strong></p>
  </Shell>;
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

function Home() { return <Shell><section className="card home-card"><span className="eyebrow">VALTREX CLOUD</span><h1>Confiança em cada verificação.</h1><p className="lead">Os convites de verificação enviados por uma loja abrem uma página personalizada e usam a autorização oficial do Discord.</p><div className="divider"/><div className="steps"><span className="step-number">01</span><div><strong>Receba um convite</strong><p>Seu vendedor compartilha um link exclusivo com você.</p></div></div><div className="steps"><span className="step-number">02</span><div><strong>Autorize no Discord</strong><p>Confira as permissões diretamente na página oficial.</p></div></div></section></Shell>; }

const path = window.location.pathname;
const gift = path.match(/^\/g\/([A-Za-z0-9_-]+)$/);
const preview = path.match(/^\/preview\/(\d{15,22})\/(\d{13})\/([0-9a-f]{64})$/);
const status = new URLSearchParams(window.location.search).get('status');
createRoot(document.getElementById('root')).render(gift ? <GiftPage token={gift[1]}/> : preview ? <PreviewPage parts={preview.slice(1)}/> : path === '/result' ? <StatusPage status={status}/> : path === '/' ? <Home/> : <StatusPage status="invalid"/>);
