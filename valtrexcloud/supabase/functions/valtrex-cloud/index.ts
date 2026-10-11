import { createClient } from 'npm:@supabase/supabase-js@2.107.0';

// O domínio pode ser trocado no deployment sem alterar o código ou os Gifts.
const configuredBase = (Deno.env.get('VALTREX_CLOUD_PUBLIC_URL') || 'https://valtrexapplications.vercel.app').replace(/\/$/, '');
const BASE = /^https:\/\/[^/\s?#]+$/.test(configuredBase) ? configuredBase : 'https://valtrexapplications.vercel.app';
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
async function bootstrap(req: Request) {
  if (!(await limit(req, 'bootstrap', 6))) return json({ error: 'Aguarde antes de tentar novamente.' }, 429);
  // O token pertence a uma aplicação bot, nunca a uma conta pessoal. Ele só é
  // usado nesta chamada para consultar a identidade oficial; não é armazenado.
  const token = (req.headers.get('authorization') || '').match(/^Bot ([A-Za-z0-9._-]{40,200})$/)?.[1];
  if (!token) return json({ error: 'Credencial do bot inválida.' }, 401);
  let identity: Response;
  try {
    identity = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { authorization: `Bot ${token}` }, signal: AbortSignal.timeout(8000),
    });
  } catch { return json({ error: 'Não foi possível validar a aplicação no Discord.' }, 503); }
  if (!identity.ok) return json({ error: 'Discord recusou a credencial do bot.' }, 401);
  const user = await identity.json();
  if (!validId(user.id) || user.bot !== true) return json({ error: 'A credencial não pertence a uma aplicação bot.' }, 401);
  const bridgeKey = randomToken() + randomToken();
  const botKeyHash = await sha(bridgeKey);
  const { data: previous } = await db.from('valtrex_tenants').select('id').eq('id', user.id).maybeSingle();
  const operation = previous
    ? db.from('valtrex_tenants').update({ bot_key_hash: botKeyHash, updated_at: new Date().toISOString() }).eq('id', user.id)
    : db.from('valtrex_tenants').insert({ id: user.id, label: String(user.username || 'Valtrex').slice(0, 80), bot_key_hash: botKeyHash });
  const { error } = await operation;
  if (error) return json({ error: 'Não foi possível criar a integração.' }, 503);
  await log(user.id, previous ? 'bridge_key_rotated' : 'bridge_created');
  return json({ applicationId: user.id, bridgeKey, apiUrl: `${BASE}/api`, redirectUri: CALLBACK });
}
function giftState(gift: any) {
  if (!gift || !gift.active) return 'invalid';
  if (gift.expires_at && Date.parse(gift.expires_at) <= Date.now()) return 'expired';
  if (gift.max_uses !== null && gift.uses >= gift.max_uses) return 'full';
  return 'active';
}
async function publicGift(token: string) {
  const gift = await giftByToken(token); const status = giftState(gift);
  if (!gift || !['active', 'full'].includes(status)) return json({ status, message: status === 'expired' ? 'Este convite expirou.' : 'Este convite não está disponível.' }, status === 'invalid' ? 404 : 410);
  const { data: tenant } = await db.from('valtrex_tenants').select('label,theme,client_id,client_secret_cipher').eq('id', gift.tenant_id).maybeSingle();
  if (!tenant?.client_id || !tenant.client_secret_cipher) return json({ status: 'incomplete', message: 'A verificação desta loja ainda não está configurada.' }, 503);
  return json({ status: 'active', kind: 'backup', title: gift.title, description: gift.description,
    banner: gift.banner_url, theme: cleanTheme(gift.theme || tenant.theme), store: tenant.label,
    expiresAt: gift.expires_at, remaining: gift.max_uses === null ? null : Math.max(0, gift.max_uses - gift.uses) });
}
async function publicVerify(id: string) {
  if (!validId(id)) return json({ status: 'invalid' }, 404);
  const { data: tenant } = await db.from('valtrex_tenants').select('label,theme,client_id,client_secret_cipher,guild_id').eq('id', id).maybeSingle();
  if (!tenant) return json({ status: 'invalid' }, 404);
  if (!tenant.client_id || !tenant.client_secret_cipher || !tenant.guild_id) return json({ status: 'incomplete' }, 503);
  return json({ status: 'active', kind: 'verify', store: tenant.label, theme: cleanTheme(tenant.theme) });
}
async function preview(id: string, expires: string, signature: string) {
  if (!validId(id) || !/^\d{13}$/.test(expires) || Number(expires) < Date.now() || Number(expires) > Date.now() + 16 * 60_000 ||
      !equal(signature, await previewSignature(id, expires))) return json({ status: 'invalid' }, 404);
  const { data } = await db.from('valtrex_tenants').select('label,theme').eq('id', id).maybeSingle();
  if (!data) return json({ status: 'invalid' }, 404);
  return json({ status: 'preview', store: data.label, theme: cleanTheme(data.theme) });
}

async function start(req: Request, token: string, flow: 'backup' | 'verify' = 'backup') {
  if (!(await limit(req, 'auth', 12))) return errorPage('busy');
  const gift = flow === 'backup' ? await giftByToken(token) : null;
  if (flow === 'backup' && !['active', 'full'].includes(giftState(gift))) return errorPage(giftState(gift));
  if (flow === 'verify' && !validId(token)) return errorPage('invalid');
  const { data: tenant } = await db.from('valtrex_tenants').select('id,client_id,client_secret_cipher,guild_id,owner_user_id')
    .eq('id', flow === 'backup' ? gift.tenant_id : token).maybeSingle();
  if (!tenant?.client_id || !tenant.client_secret_cipher || (flow === 'verify' && !tenant.guild_id) ||
      (flow === 'backup' && !tenant.owner_user_id)) return errorPage('incomplete');
  const state = randomToken(); const verifier = randomToken();
  const { error } = await db.from('valtrex_oauth_states').insert({ state_hash: await sha(state), verifier_hash: await sha(verifier),
    gift_id: gift?.id || null, tenant_id: tenant.id, flow, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  if (error) return errorPage('temporary');
  const params = new URLSearchParams({ client_id: tenant.client_id, redirect_uri: CALLBACK,
    response_type: 'code', scope: flow === 'verify' ? 'identify guilds.join' : 'identify guilds', state, prompt: 'consent' });
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
  const { data: states, error: stateError } = await db.rpc('valtrex_take_oauth_state_v2', { p_state_hash: await sha(state), p_verifier_hash: await sha(verifier) });
  if (stateError || !states?.length) return redirect('/result?status=invalid', clear);
  const row = states[0];
  const { data: tenant } = await db.from('valtrex_tenants').select('*').eq('id', row.tenant_id).maybeSingle();
  const { data: gift } = row.flow === 'backup' ? await db.from('valtrex_gifts').select('*').eq('id', row.gift_id).eq('tenant_id', row.tenant_id).maybeSingle() : { data: null };
  if (!tenant?.client_id || !tenant.client_secret_cipher || (row.flow === 'backup' && !gift)) return redirect('/result?status=incomplete', clear);
  // A função atômica confere limite e idempotência; uma pessoa já verificada
  // pode concluir o callback mesmo que o último uso tenha preenchido o Gift.
  if (row.flow === 'backup' && ['invalid', 'expired'].includes(giftState(gift))) return redirect(`/result?status=${giftState(gift)}`, clear);
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
    if (row.flow === 'verify') {
      if (!tokenData.scope?.split(' ').includes('guilds.join') || !tokenData.refresh_token) return redirect('/result?status=oauth', clear);
      const { error: consentError } = await db.from('valtrex_consents').upsert({ tenant_id: tenant.id, discord_user_id: user.id,
        access_cipher: await seal(tokenData.access_token), refresh_cipher: await seal(tokenData.refresh_token),
        expires_at: new Date(Date.now() + Number(tokenData.expires_in || 0) * 1000).toISOString(),
        consented_at: new Date().toISOString(), retention_until: new Date(Date.now() + 90 * 86400_000).toISOString(), revoked_at: null });
      if (consentError) return redirect('/result?status=temporary', clear);
      const { data: verified, error: verifyError } = await db.rpc('valtrex_claim_verify', { p_tenant_id: tenant.id, p_user_id: user.id });
      if (verifyError || !verified) return redirect('/result?status=temporary', clear);
      await log(tenant.id, 'verification_completed', { verification_id: verified });
      return redirect('/result?status=success', clear);
    }
    if (row.flow !== 'backup' || user.id !== tenant.owner_user_id) return redirect('/result?status=forbidden', clear);
    const guildResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { authorization: `Bearer ${tokenData.access_token}` }, signal: AbortSignal.timeout(8000) });
    if (!guildResponse.ok) return redirect('/result?status=oauth', clear);
    const allowed = (await guildResponse.json()).filter((g: any) => validId(g.id) &&
      (g.owner === true || (BigInt(g.permissions || '0') & 0x20n) !== 0n)).map((g: any) => ({ id: g.id, name: String(g.name || 'Servidor').slice(0, 80) }));
    const { data: claim, error: claimError } = await db.rpc('valtrex_claim_backup_gift', { p_gift_id: gift.id, p_user_id: user.id });
    if (claimError) return redirect('/result?status=temporary', clear);
    if (claim !== 'ok' && claim !== 'already') return redirect(`/result?status=${claim}`, clear);
    const session = randomToken() + randomToken();
    const { error: sessionError } = await db.from('valtrex_gift_sessions').insert({ session_hash: await sha(session),
      gift_id: gift.id, tenant_id: tenant.id, discord_user_id: user.id, guilds: allowed,
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString() });
    if (sessionError) return redirect('/result?status=temporary', clear);
    await log(tenant.id, 'gift_login_completed', { gift_id: gift.id });
    return redirect(`/g/${await open(gift.token_cipher)}/setup`,
      `vtx_gift=${session}; Path=/api; Max-Age=3600; HttpOnly; Secure; SameSite=Lax`);
  } catch { await log(tenant.id, 'oauth_failed'); return redirect('/result?status=temporary', clear); }
}

async function giftSession(req: Request, token: string) {
  const gift = await giftByToken(token);
  if (!gift || giftState(gift) === 'invalid' || giftState(gift) === 'expired') return null;
  const value = cookieValue(req, 'vtx_gift');
  if (!/^[A-Za-z0-9_-]{80,200}$/.test(value)) return null;
  const { data } = await db.from('valtrex_gift_sessions').select('*').eq('session_hash', await sha(value))
    .eq('gift_id', gift.id).eq('tenant_id', gift.tenant_id).gt('expires_at', new Date().toISOString()).maybeSingle();
  return data ? { gift, session: data } : null;
}
async function giftSetup(req: Request, token: string, action: string) {
  if (!(await limit(req, 'gift_setup', 40))) return json({ error: 'Aguarde antes de tentar novamente.' }, 429);
  const authorized = await giftSession(req, token);
  if (!authorized) return json({ error: 'Faça login novamente pelo Gift.' }, 401);
  const { gift, session } = authorized;
  const { data: tenant } = await db.from('valtrex_tenants').select('id,client_id,owner_user_id,bot_guild_ids,bot_seen_at').eq('id', gift.tenant_id).maybeSingle();
  if (!tenant || tenant.owner_user_id !== session.discord_user_id) return json({ error: 'Acesso negado.' }, 403);
  const { count: eligible } = await db.from('valtrex_consents').select('discord_user_id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id).is('revoked_at', null).gt('retention_until', new Date().toISOString());
  if (req.method === 'GET' && !action) {
    return json({ guilds: session.guilds, eligible: eligible || 0, applicationId: tenant.client_id,
      botGuilds: Date.parse(tenant.bot_seen_at || '') > Date.now() - 180_000 ? tenant.bot_guild_ids : [] });
  }
  if (req.method === 'POST' && action === 'recovery') {
    if (req.headers.get('origin') !== BASE || !req.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'Origem inválida.' }, 403);
    const input = await body(req); const guildId = String(input.guildId || ''); const count = Number(input.count);
    if (!validId(guildId) || !Number.isInteger(count) || count < 1 || count > 500)
      return json({ error: 'Informe um servidor e uma quantidade entre 1 e 500.' }, 400);
    if (!Array.isArray(session.guilds) || !session.guilds.some((g: any) => g.id === guildId))
      return json({ error: 'Sua conta não administra este servidor.' }, 403);
    if (Date.parse(tenant.bot_seen_at || '') <= Date.now() - 180_000 || !Array.isArray(tenant.bot_guild_ids) || !tenant.bot_guild_ids.includes(guildId))
      return json({ error: 'Adicione o bot a este servidor e aguarde a conexão antes de continuar.' }, 409);
    if (count > (eligible || 0)) return json({ error: `Há somente ${eligible || 0} membros com autorização válida nesta loja.` }, 409);
    const { data: existing } = await db.from('valtrex_backup_jobs').select('id').eq('gift_id', gift.id)
      .eq('actor_user_id', session.discord_user_id).eq('target_guild_id', guildId).maybeSingle();
    if (existing) return json({ error: 'Este Gift já iniciou uma recuperação para esse servidor.' }, 409);
    const { data: members, error: memberError } = await db.from('valtrex_consents').select('discord_user_id')
      .eq('tenant_id', tenant.id).is('revoked_at', null).gt('retention_until', new Date().toISOString()).order('consented_at').limit(count);
    if (memberError || !members || members.length < count) return json({ error: 'As autorizações disponíveis mudaram. Atualize a página.' }, 409);
    const { data: job, error: jobError } = await db.from('valtrex_backup_jobs').insert({ tenant_id: tenant.id, gift_id: gift.id,
      actor_user_id: session.discord_user_id, target_guild_id: guildId, requested_count: count }).select('id').single();
    if (jobError) return json({ error: 'Não foi possível iniciar a recuperação.' }, 409);
    const { error: queueError } = await db.from('valtrex_backup_job_members').insert(members.map((m: any) => ({
      tenant_id: tenant.id, job_id: job.id, discord_user_id: m.discord_user_id })));
    if (queueError) {
      await db.from('valtrex_backup_jobs').update({ status: 'failed' }).eq('id', job.id);
      return json({ error: 'Não foi possível preparar os membros. Nenhuma transferência começou.' }, 503);
    }
    await log(tenant.id, 'backup_started', { job_id: job.id, target_guild_id: guildId, requested: count });
    return json({ jobId: job.id, requested: count }, 201);
  }
  const jobId = action.match(/^job\/([0-9a-f-]{36})$/)?.[1];
  if (req.method === 'GET' && jobId) {
    const { data: job } = await db.from('valtrex_backup_jobs').select('id,status,requested_count,target_guild_id')
      .eq('id', jobId).eq('gift_id', gift.id).eq('actor_user_id', session.discord_user_id).maybeSingle();
    if (!job) return json({ error: 'Pedido não encontrado.' }, 404);
    const { data: rows } = await db.from('valtrex_backup_job_members').select('status').eq('job_id', job.id).eq('tenant_id', tenant.id);
    return json({ status: job.status, requested: job.requested_count, targetGuildId: job.target_guild_id,
      joined: rows?.filter((r: any) => r.status === 'joined').length || 0,
      failed: rows?.filter((r: any) => r.status === 'failed').length || 0,
      skipped: rows?.filter((r: any) => r.status === 'skipped').length || 0,
      pending: rows?.filter((r: any) => ['queued', 'processing'].includes(r.status)).length || 0 });
  }
  return json({ error: 'Rota não encontrada.' }, 404);
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
      logChannelId: tenant.log_channel_id, theme: cleanTheme(tenant.theme), messages: tenant.messages, verified: verified ?? 0,
      verifyUrl: `${BASE}/v/${tenant.id}`, ownerConfigured: !!tenant.owner_user_id,
      verifyChannelId: tenant.verify_channel_id, verifyMessageId: tenant.verify_message_id });
  }
  if (path === 'config' && req.method === 'PUT') {
    const input = await body(req); const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.clientId !== undefined) { if (!validId(input.clientId) || input.clientId !== tenant.id) return json({ error: 'Client ID deve corresponder à aplicação do bot.' }, 400); update.client_id = input.clientId; }
    if (input.clientSecret) { if (typeof input.clientSecret !== 'string' || input.clientSecret.length > 300) return json({ error: 'Client Secret inválido.' }, 400); update.client_secret_cipher = await seal(input.clientSecret); }
    if (input.ownerUserId !== undefined) {
      if (!validId(input.ownerUserId) || (tenant.owner_user_id && tenant.owner_user_id !== input.ownerUserId))
        return json({ error: 'O proprietário desta aplicação já está vinculado a outra conta.' }, 403);
      update.owner_user_id = input.ownerUserId;
    }
    for (const [field, key] of [['guildId', 'guild_id'], ['backupGuildId', 'backup_guild_id'], ['roleId', 'role_id'], ['logChannelId', 'log_channel_id'],
      ['verifyChannelId', 'verify_channel_id'], ['verifyMessageId', 'verify_message_id']]) {
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
    const rawPage = Number(new URL(req.url).searchParams.get('page') || 0);
    const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0;
    const { data, error, count } = await db.from('valtrex_gifts').select('*', { count: 'exact' }).eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }).range(page * 25, page * 25 + 24);
    if (error) return json({ error: 'Falha ao carregar gifts.' }, 500);
    const gifts = await Promise.all((data || []).map(async (gift: any) => ({ id: gift.id, name: gift.internal_name,
      title: gift.title, description: gift.description, banner: gift.banner_url, active: gift.active,
      status: giftState(gift), uses: gift.uses, maxUses: gift.max_uses, expiresAt: gift.expires_at,
      createdAt: gift.created_at, theme: gift.theme, link: `${BASE}/g/${await open(gift.token_cipher)}` })));
    return json({ gifts, total: count || 0, page, pages: Math.max(1, Math.ceil((count || 0) / 25)) });
  }
  if (path === 'gifts' && req.method === 'POST') {
    const input = await body(req);
    const title = String(input.title || '').trim().slice(0, 100);
    const name = String(input.name || title).trim().slice(0, 100);
    const max = input.maxUses === null || input.maxUses === undefined ? null : Number(input.maxUses);
    const expires = input.expiresAt ? new Date(input.expiresAt) : null;
    if (!title || !name || (max !== null && (!Number.isSafeInteger(max) || max < 1)) || (expires && (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()))) return json({ error: 'Título, limite ou expiração inválidos.' }, 400);
    if (!tenant.client_id || !tenant.client_secret_cipher || !tenant.owner_user_id) return json({ error: 'Configure OAuth e vincule o proprietário antes de criar Gifts.' }, 409);
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
  if (match && req.method === 'GET') {
    const { data: gift } = await db.from('valtrex_gifts').select('*').eq('id', match[1]).eq('tenant_id', tenant.id).maybeSingle();
    if (!gift) return json({ error: 'Gift não encontrado.' }, 404);
    return json({ id: gift.id, name: gift.internal_name, title: gift.title, description: gift.description,
      banner: gift.banner_url, active: gift.active, status: giftState(gift), uses: gift.uses,
      maxUses: gift.max_uses, expiresAt: gift.expires_at, createdAt: gift.created_at,
      link: `${BASE}/g/${await open(gift.token_cipher)}` });
  }
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
  if (path === 'heartbeat' && req.method === 'POST') {
    const input = await body(req);
    if (!Array.isArray(input.guildIds) || input.guildIds.length > 500 || !input.guildIds.every(validId))
      return json({ error: 'Lista de servidores inválida.' }, 400);
    const { error } = await db.from('valtrex_tenants').update({ bot_guild_ids: [...new Set(input.guildIds)],
      bot_seen_at: new Date().toISOString() }).eq('id', tenant.id);
    await db.from('valtrex_consents').delete().eq('tenant_id', tenant.id).lt('retention_until', new Date().toISOString());
    return json({ ok: !error }, error ? 503 : 200);
  }
  if (path === 'joins' && req.method === 'GET') {
    const { data: tasks, error } = await db.rpc('valtrex_take_join_tasks', { p_tenant_id: tenant.id, p_max: 5 });
    if (error) return json({ error: 'Fila temporariamente indisponível.' }, 503);
    const ready = [];
    for (const task of tasks || []) {
      const { data: consent } = await db.from('valtrex_consents').select('*').eq('tenant_id', tenant.id)
        .eq('discord_user_id', task.discord_user_id).is('revoked_at', null).gt('retention_until', new Date().toISOString()).maybeSingle();
      if (!consent) {
        await db.from('valtrex_backup_job_members').update({ status: 'failed', reason: 'Autorização removida.', updated_at: new Date().toISOString() }).eq('id', task.id);
        continue;
      }
      let access = '';
      try {
        access = await open(consent.access_cipher);
        if (Date.parse(consent.expires_at) < Date.now() + 60_000) {
          const response = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(8000),
            body: new URLSearchParams({ client_id: tenant.client_id, client_secret: await open(tenant.client_secret_cipher),
              grant_type: 'refresh_token', refresh_token: await open(consent.refresh_cipher) }) });
          if (!response.ok) throw new Error('refresh');
          const refreshed = await response.json();
          if (!refreshed.access_token || !refreshed.refresh_token ||
              (refreshed.scope && !String(refreshed.scope).split(' ').includes('guilds.join')))
            throw new Error('scope');
          access = refreshed.access_token;
          await db.from('valtrex_consents').update({ access_cipher: await seal(access), refresh_cipher: await seal(refreshed.refresh_token),
            expires_at: new Date(Date.now() + Number(refreshed.expires_in || 0) * 1000).toISOString() })
            .eq('tenant_id', tenant.id).eq('discord_user_id', task.discord_user_id);
        }
      } catch {
        await db.from('valtrex_backup_job_members').update({ status: 'failed', reason: 'Autorização Discord expirada ou revogada.',
          updated_at: new Date().toISOString() }).eq('id', task.id);
        await db.from('valtrex_consents').update({ revoked_at: new Date().toISOString() }).eq('tenant_id', tenant.id).eq('discord_user_id', task.discord_user_id);
        continue;
      }
      ready.push({ id: task.id, jobId: task.job_id, userId: task.discord_user_id, guildId: task.target_guild_id, accessToken: access });
    }
    return json({ tasks: ready });
  }
  if (path === 'join-result' && req.method === 'POST') {
    const input = await body(req);
    if (!/^[0-9a-f-]{36}$/.test(input.id || '') || !['joined', 'failed', 'skipped', 'retry'].includes(input.status)) return json({ error: 'Resultado inválido.' }, 400);
    const { data: current } = await db.from('valtrex_backup_job_members').select('attempts').eq('id', input.id)
      .eq('tenant_id', tenant.id).eq('status', 'processing').maybeSingle();
    if (!current) return json({ ok: false }, 409);
    const outcome = input.status === 'retry' ? (current.attempts < 3 ? 'queued' : 'failed') : input.status;
    const { data: member } = await db.from('valtrex_backup_job_members').update({ status: outcome,
      reason: String(input.reason || '').slice(0, 160), updated_at: new Date().toISOString() })
      .eq('id', input.id).eq('tenant_id', tenant.id).eq('status', 'processing').select('job_id').maybeSingle();
    if (!member) return json({ ok: false }, 409);
    const { data: rows } = await db.from('valtrex_backup_job_members').select('status').eq('job_id', member.job_id).eq('tenant_id', tenant.id);
    if (rows && !rows.some((r: any) => ['queued', 'processing'].includes(r.status))) {
      const status = rows.every((r: any) => r.status === 'joined') ? 'completed' : 'partial';
      await db.from('valtrex_backup_jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', member.job_id).eq('tenant_id', tenant.id);
      await log(tenant.id, 'backup_finished', { job_id: member.job_id, status,
        joined: rows.filter((r: any) => r.status === 'joined').length });
    }
    return json({ ok: true });
  }
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
    if (path === 'bootstrap' && req.method === 'POST') return await bootstrap(req);
    const gift = path.match(/^g\/([A-Za-z0-9_-]+)$/);
    if (gift && req.method === 'GET') return await publicGift(gift[1]);
    const verify = path.match(/^v\/(\d{15,22})$/);
    if (verify && req.method === 'GET') return await publicVerify(verify[1]);
    const giftAction = path.match(/^gift\/([A-Za-z0-9_-]+)(?:\/(.*))?$/);
    if (giftAction) return await giftSetup(req, giftAction[1], giftAction[2] || '');
    const previewPath = path.match(/^preview\/(\d{15,22})\/(\d{13})\/([0-9a-f]{64})$/);
    if (previewPath && req.method === 'GET') return await preview(previewPath[1], previewPath[2], previewPath[3]);
    const auth = path.match(/^auth\/start\/([A-Za-z0-9_-]+)$/);
    if (auth && req.method === 'GET') return await start(req, auth[1], 'backup');
    const verifyAuth = path.match(/^auth\/verify\/(\d{15,22})$/);
    if (verifyAuth && req.method === 'GET') return await start(req, verifyAuth[1], 'verify');
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
