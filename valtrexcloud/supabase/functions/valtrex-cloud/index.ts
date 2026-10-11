import { createClient } from 'npm:@supabase/supabase-js@2.107.0';

const BASE = 'https://systembux.vercel.app';
const CALLBACK = `${BASE}/api/auth/discord/callback`;
const encoder = new TextEncoder();
const db = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const defaults = {
  preset: 'valtrex', name: 'Valtrex', title: 'Verifique sua conta',
  description: 'Conecte sua conta Discord para concluir a verificação.',
  primary: '#7968f8', secondary: '#a99eff', text: '#f6f5fb',
  background: '#08090d', card: '#161821', border: '#393c4e',
  radius: 22, button: 'Continuar com Discord', footer: 'ValtrexCloud',
  logo: '', banner: '', backgroundImage: '', success: 'Verificação concluída.',
  expired: 'Este convite expirou.',
};

function bytes(size = 32) { const data = new Uint8Array(size); crypto.getRandomValues(data); return data; }
function randomToken() { return btoa(String.fromCharCode(...bytes())).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
async function sha(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
async function previewSignature(id: string, expires: string) {
  const role = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const key = await crypto.subtle.importKey('raw', encoder.encode(role), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`valtrex-preview-v1:${id}:${expires}`)));
  return Array.from(signed, b => b.toString(16).padStart(2, '0')).join('');
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function cipherKey() {
  const role = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!role) throw new Error('Backend não configurado');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`valtrexcloud-aes-v1\0${role}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(value: string) {
  const iv = bytes(12); const key = await cipherKey();
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value)));
  return `v1:${btoa(String.fromCharCode(...iv))}:${btoa(String.fromCharCode(...encrypted))}`;
}
async function open(value: string) {
  const [version, iv, data] = value.split(':');
  if (version !== 'v1' || !iv || !data) throw new Error('Credencial indisponível');
  const rawIv = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const rawData = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rawIv }, await cipherKey(), rawData));
}
function headers(extra: Record<string, string> = {}) {
  return { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'", ...extra };
}
function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: headers(extra) });
}
function redirect(path: string, cookie = '') {
  const extra: Record<string, string> = { location: `${BASE}${path}` };
  if (cookie) extra['set-cookie'] = cookie;
  return new Response(null, { status: 302, headers: headers(extra) });
}
function errorPage(status: string) { return redirect(`/result?status=${encodeURIComponent(status)}`); }
function cookieValue(req: Request, name: string) {
  const match = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}
function validId(value: unknown) { return typeof value === 'string' && /^\d{15,22}$/.test(value); }
function validImage(value: unknown) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 500) throw new Error('Imagem inválida');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname)) throw new Error('Imagem inválida');
  return url.toString();
}
function cleanTheme(input: any) {
  const source = input && typeof input === 'object' ? input : {};
  const result: Record<string, string | number> = { ...defaults };
  for (const key of ['name', 'title', 'description', 'button', 'footer', 'success', 'expired']) {
    if (typeof source[key] === 'string') result[key] = source[key].trim().slice(0, key === 'description' ? 500 : 120);
  }
  for (const key of ['primary', 'secondary', 'text', 'background', 'card', 'border']) {
    if (typeof source[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(source[key])) result[key] = source[key];
  }
  for (const key of ['logo', 'banner', 'backgroundImage']) if (source[key]) result[key] = validImage(source[key]);
  if (Number.isInteger(source.radius)) result.radius = Math.min(32, Math.max(4, source.radius));
  if (['valtrex', 'dark', 'light', 'minimal', 'custom'].includes(source.preset)) result.preset = source.preset;
  return result;
}
async function log(tenantId: string, event: string, detail: Record<string, string | number | boolean> = {}) {
  await db.from('valtrex_logs').insert({ tenant_id: tenantId, event, detail });
}
async function limit(req: Request, kind: string, max: number) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown').split(',')[0].trim();
  const key = await sha(`${kind}:${ip}`);
  const { data, error } = await db.rpc('valtrex_rate_limit', { p_key_hash: key, p_max: max });
  return !error && data === true;
}
async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 16000) throw new Error('Requisição muito grande');
  const value = await req.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dados inválidos');
  return value as Record<string, any>;
}
async function tenantAuth(req: Request) {
  const id = req.headers.get('x-valtrex-application') || '';
  const key = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
  if (!validId(id) || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) return null;
  const { data } = await db.from('valtrex_tenants').select('*').eq('id', id).maybeSingle();
  if (!data || !equal(data.bot_key_hash, await sha(key))) return null;
  return data;
}
async function giftByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null;
  const { data } = await db.from('valtrex_gifts').select('*').eq('token_hash', await sha(token)).maybeSingle();
  return data;
}
function giftState(gift: any) {
  if (!gift || !gift.active) return 'invalid';
  if (gift.expires_at && Date.parse(gift.expires_at) <= Date.now()) return 'expired';
  if (gift.max_uses !== null && gift.uses >= gift.max_uses) return 'full';
  return 'active';
}
async function publicGift(token: string) {
  const gift = await giftByToken(token); const status = giftState(gift);
  if (!gift || status !== 'active') return json({ status, message: status === 'expired' ? 'Este convite expirou.' : status === 'full' ? 'Este convite atingiu o limite de usos.' : 'Este convite não está disponível.' }, status === 'invalid' ? 404 : 410);
  const { data: tenant } = await db.from('valtrex_tenants').select('label,theme,client_id,client_secret_cipher').eq('id', gift.tenant_id).maybeSingle();
  if (!tenant?.client_id || !tenant.client_secret_cipher) return json({ status: 'incomplete', message: 'A verificação desta loja ainda não está configurada.' }, 503);
  return json({ status: 'active', title: gift.title, description: gift.description,
    banner: gift.banner_url, theme: cleanTheme(gift.theme || tenant.theme), store: tenant.label,
    expiresAt: gift.expires_at, remaining: gift.max_uses === null ? null : Math.max(0, gift.max_uses - gift.uses) });
}
async function preview(id: string, expires: string, signature: string) {
  if (!validId(id) || !/^\d{13}$/.test(expires) || Number(expires) < Date.now() || Number(expires) > Date.now() + 16 * 60_000 ||
      !equal(signature, await previewSignature(id, expires))) return json({ status: 'invalid' }, 404);
  const { data } = await db.from('valtrex_tenants').select('label,theme').eq('id', id).maybeSingle();
  if (!data) return json({ status: 'invalid' }, 404);
  return json({ status: 'preview', store: data.label, theme: cleanTheme(data.theme) });
}

async function start(req: Request, token: string) {
  if (!(await limit(req, 'auth', 12))) return errorPage('busy');
  const gift = await giftByToken(token);
  if (giftState(gift) !== 'active') return errorPage(giftState(gift));
  const { data: tenant } = await db.from('valtrex_tenants').select('id,client_id,client_secret_cipher').eq('id', gift.tenant_id).maybeSingle();
  if (!tenant?.client_id || !tenant.client_secret_cipher) return errorPage('incomplete');
  const state = randomToken(); const verifier = randomToken();
  const { error } = await db.from('valtrex_oauth_states').insert({ state_hash: await sha(state), verifier_hash: await sha(verifier),
    gift_id: gift.id, tenant_id: tenant.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) return errorPage('temporary');
  const params = new URLSearchParams({ client_id: tenant.client_id, redirect_uri: CALLBACK,
    response_type: 'code', scope: 'identify', state, prompt: 'consent' });
  return new Response(null, { status: 302, headers: headers({
    location: `https://discord.com/oauth2/authorize?${params}`,
    'set-cookie': `vtx_oauth=${verifier}; Path=/api/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
  }) });
}

async function callback(req: Request, url: URL) {
  const clear = 'vtx_oauth=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax';
  if (!(await limit(req, 'callback', 20))) return redirect('/result?status=busy', clear);
  if (url.searchParams.get('error')) return redirect('/result?status=cancelled', clear);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const verifier = cookieValue(req, 'vtx_oauth');
  if (!code || !/^[A-Za-z0-9_-]{40,100}$/.test(state) || !verifier) return redirect('/result?status=invalid', clear);
  const { data: states, error: stateError } = await db.rpc('valtrex_take_oauth_state', { p_state_hash: await sha(state), p_verifier_hash: await sha(verifier) });
  if (stateError || !states?.length) return redirect('/result?status=invalid', clear);
  const row = states[0];
  const { data: tenant } = await db.from('valtrex_tenants').select('*').eq('id', row.tenant_id).maybeSingle();
  const { data: gift } = await db.from('valtrex_gifts').select('id,active,expires_at,max_uses,uses').eq('id', row.gift_id).eq('tenant_id', row.tenant_id).maybeSingle();
  if (!tenant?.client_id || !tenant.client_secret_cipher || !gift) return redirect('/result?status=incomplete', clear);
  // A função atômica confere limite e idempotência; uma pessoa já verificada
  // pode concluir o callback mesmo que o último uso tenha preenchido o Gift.
  if (giftState(gift) === 'invalid' || giftState(gift) === 'expired') return redirect(`/result?status=${giftState(gift)}`, clear);
  try {
    const secret = await open(tenant.client_secret_cipher);
    const token = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: tenant.client_id, client_secret: secret, grant_type: 'authorization_code', code, redirect_uri: CALLBACK }),
    });
    if (!token.ok) { await log(tenant.id, 'oauth_rejected'); return redirect('/result?status=oauth', clear); }
    const tokenData = await token.json();
    if (!tokenData.access_token || tokenData.token_type !== 'Bearer') return redirect('/result?status=oauth', clear);
    const identity = await fetch('https://discord.com/api/v10/users/@me', { headers: { authorization: `Bearer ${tokenData.access_token}` } });
    if (!identity.ok) return redirect('/result?status=oauth', clear);
    const user = await identity.json();
    if (!validId(user.id)) return redirect('/result?status=oauth', clear);
    const { data: claim, error: claimError } = await db.rpc('valtrex_claim_gift', { p_gift_id: gift.id, p_user_id: user.id });
    if (claimError || !claim?.length) return redirect('/result?status=temporary', clear);
    const status = claim[0].claim_status;
    await log(tenant.id, status === 'ok' ? 'verification_completed' : `gift_${status}`, { gift_id: gift.id });
    return redirect(`/result?status=${status === 'ok' || status === 'already' ? 'success' : status}`, clear);
  } catch { await log(tenant.id, 'oauth_failed'); return redirect('/result?status=temporary', clear); }
}

async function admin(req: Request, path: string) {
  if (!(await limit(req, 'admin', 80))) return json({ error: 'Muitas solicitações.' }, 429);
  const tenant = await tenantAuth(req);
  if (!tenant) return json({ error: 'Acesso negado.' }, 401);
  if (path === 'preview' && req.method === 'POST') {
    const expires = String(Date.now() + 15 * 60_000);
    const signature = await previewSignature(tenant.id, expires);
    return json({ link: `${BASE}/preview/${tenant.id}/${expires}/${signature}` });
  }
  if (path === 'config' && req.method === 'GET') {
    const { count: verified } = await db.from('valtrex_verifications').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
    return json({ applicationId: tenant.id, label: tenant.label, clientId: tenant.client_id, secretConfigured: !!tenant.client_secret_cipher,
      redirectUri: CALLBACK, guildId: tenant.guild_id, backupGuildId: tenant.backup_guild_id, roleId: tenant.role_id,
      logChannelId: tenant.log_channel_id, theme: cleanTheme(tenant.theme), messages: tenant.messages, verified: verified ?? 0 });
  }
  if (path === 'config' && req.method === 'PUT') {
    const input = await body(req); const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.clientId !== undefined) { if (!validId(input.clientId) || input.clientId !== tenant.id) return json({ error: 'Client ID deve corresponder à aplicação do bot.' }, 400); update.client_id = input.clientId; }
    if (input.clientSecret) { if (typeof input.clientSecret !== 'string' || input.clientSecret.length > 300) return json({ error: 'Client Secret inválido.' }, 400); update.client_secret_cipher = await seal(input.clientSecret); }
    for (const [field, key] of [['guildId', 'guild_id'], ['backupGuildId', 'backup_guild_id'], ['roleId', 'role_id'], ['logChannelId', 'log_channel_id']]) {
      if (input[field] !== undefined) { if (input[field] && !validId(input[field])) return json({ error: `${field} inválido.` }, 400); update[key] = input[field] || null; }
    }
    if (input.label !== undefined) update.label = String(input.label).trim().slice(0, 80);
    if (input.theme !== undefined) update.theme = cleanTheme(input.theme);
    if (input.messages !== undefined) {
      const messages: Record<string, string> = {};
      for (const key of ['success', 'expired', 'invalid', 'oauthError', 'roleGranted', 'roleFailed'])
        if (typeof input.messages?.[key] === 'string') messages[key] = input.messages[key].slice(0, 300);
      update.messages = messages;
    }
    const { error } = await db.from('valtrex_tenants').update(update).eq('id', tenant.id);
    if (error) return json({ error: 'Não foi possível salvar a configuração.' }, 500);
    await log(tenant.id, 'configuration_changed');
    return json({ ok: true, secretConfigured: !!(update.client_secret_cipher || tenant.client_secret_cipher), redirectUri: CALLBACK });
  }
  if (path === 'theme/reset' && req.method === 'POST') {
    const { error } = await db.from('valtrex_tenants').update({ theme: {}, updated_at: new Date().toISOString() }).eq('id', tenant.id);
    if (error) return json({ error: 'Falha no reset.' }, 500);
    await log(tenant.id, 'appearance_reset'); return json({ ok: true, theme: defaults });
  }
  if (path === 'gifts' && req.method === 'GET') {
    const { data, error } = await db.from('valtrex_gifts').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(100);
    if (error) return json({ error: 'Falha ao carregar gifts.' }, 500);
    const gifts = await Promise.all((data || []).map(async (gift: any) => ({ id: gift.id, name: gift.internal_name,
      title: gift.title, description: gift.description, banner: gift.banner_url, active: gift.active,
      status: giftState(gift), uses: gift.uses, maxUses: gift.max_uses, expiresAt: gift.expires_at,
      createdAt: gift.created_at, theme: gift.theme, link: `${BASE}/g/${await open(gift.token_cipher)}` })));
    return json({ gifts });
  }
  if (path === 'gifts' && req.method === 'POST') {
    const input = await body(req);
    const title = String(input.title || '').trim().slice(0, 100);
    const name = String(input.name || title).trim().slice(0, 100);
    const max = input.maxUses === null || input.maxUses === undefined ? null : Number(input.maxUses);
    const expires = input.expiresAt ? new Date(input.expiresAt) : null;
    if (!title || !name || (max !== null && (!Number.isSafeInteger(max) || max < 1)) || (expires && (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()))) return json({ error: 'Título, limite ou expiração inválidos.' }, 400);
    if (!tenant.client_id || !tenant.client_secret_cipher) return json({ error: 'Configure OAuth antes de criar Gifts.' }, 409);
    const token = randomToken(); const gift = { tenant_id: tenant.id, token_hash: await sha(token), token_cipher: await seal(token),
      internal_name: name, title, description: String(input.description || '').slice(0, 500),
      banner_url: validImage(input.banner), expires_at: expires?.toISOString() || null,
      max_uses: max, theme: input.theme ? cleanTheme(input.theme) : null,
      success_message: String(input.successMessage || '').slice(0, 300) || null };
    const { data, error } = await db.from('valtrex_gifts').insert(gift).select('id').single();
    if (error) return json({ error: 'Falha ao criar Gift.' }, 500);
    await log(tenant.id, 'gift_created', { gift_id: data.id });
    return json({ id: data.id, link: `${BASE}/g/${token}` }, 201);
  }
  const match = path.match(/^gifts\/([0-9a-f-]{36})$/);
  if (match && req.method === 'PATCH') {
    const input = await body(req); const update: Record<string, unknown> = {};
    if (typeof input.active === 'boolean') update.active = input.active;
    if (typeof input.title === 'string') update.title = input.title.trim().slice(0, 100);
    if (typeof input.description === 'string') update.description = input.description.slice(0, 500);
    if (input.banner !== undefined) update.banner_url = validImage(input.banner);
    if (input.maxUses !== undefined) { const v = input.maxUses === null ? null : Number(input.maxUses); if (v !== null && (!Number.isSafeInteger(v) || v < 1)) return json({ error: 'Limite inválido.' }, 400); update.max_uses = v; }
    if (!Object.keys(update).length) return json({ error: 'Nada para alterar.' }, 400);
    const { data, error } = await db.from('valtrex_gifts').update(update).eq('id', match[1]).eq('tenant_id', tenant.id).select('id').maybeSingle();
    if (error || !data) return json({ error: 'Gift não encontrado.' }, 404);
    await log(tenant.id, input.active === false ? 'gift_disabled' : 'gift_edited', { gift_id: data.id });
    return json({ ok: true });
  }
  if (path === 'logs' && req.method === 'GET') {
    const { data } = await db.from('valtrex_logs').select('event,detail,created_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50);
    return json({ logs: data || [] });
  }
  return json({ error: 'Rota não encontrada.' }, 404);
}

async function bot(req: Request, path: string) {
  const tenant = await tenantAuth(req);
  if (!tenant) return json({ error: 'Acesso negado.' }, 401);
  if (path === 'pending' && req.method === 'GET') {
    const { data } = await db.from('valtrex_verifications').select('id,discord_user_id,created_at').eq('tenant_id', tenant.id).eq('role_status', 'pending').order('created_at').limit(20);
    return json({ guildId: tenant.guild_id, roleId: tenant.role_id, logChannelId: tenant.log_channel_id, verifications: data || [] });
  }
  if (path === 'result' && req.method === 'POST') {
    const input = await body(req);
    if (!/^[0-9a-f-]{36}$/.test(input.id || '') || !['granted', 'failed', 'not_configured'].includes(input.status)) return json({ error: 'Resultado inválido.' }, 400);
    const { data } = await db.from('valtrex_verifications').update({ role_status: input.status, role_reason: String(input.reason || '').slice(0, 180), updated_at: new Date().toISOString() })
      .eq('id', input.id).eq('tenant_id', tenant.id).eq('role_status', 'pending').select('id').maybeSingle();
    if (data) await log(tenant.id, input.status === 'granted' ? 'role_granted' : 'role_failed', { verification_id: data.id });
    return json({ ok: !!data });
  }
  return json({ error: 'Rota não encontrada.' }, 404);
}

Deno.serve(async req => {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/valtrex-cloud\/?/, '').replace(/^\/+/, '');
    if (path === 'health') return json({ service: 'ValtrexCloud', status: 'ready', redirectUri: CALLBACK });
    const gift = path.match(/^g\/([A-Za-z0-9_-]+)$/);
    if (gift && req.method === 'GET') return await publicGift(gift[1]);
    const previewPath = path.match(/^preview\/(\d{15,22})\/(\d{13})\/([0-9a-f]{64})$/);
    if (previewPath && req.method === 'GET') return await preview(previewPath[1], previewPath[2], previewPath[3]);
    const auth = path.match(/^auth\/start\/([A-Za-z0-9_-]+)$/);
    if (auth && req.method === 'GET') return await start(req, auth[1]);
    if (path === 'auth/discord/callback' && req.method === 'GET') return await callback(req, url);
    if (path.startsWith('admin/')) return await admin(req, path.slice(6));
    if (path.startsWith('bot/')) return await bot(req, path.slice(4));
    return json({ error: 'Rota não encontrada.' }, 404);
  } catch (error) {
    // Erros internos nunca incluem credenciais nem stack trace na resposta pública.
    console.error('[ValtrexCloud] Falha em rota:', error instanceof Error ? error.name : 'Unknown');
    return json({ error: 'Serviço temporariamente indisponível.' }, 503);
  }
});
