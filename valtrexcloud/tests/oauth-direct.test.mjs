import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const hash = value => createHash('sha256').update(value).digest('hex');
const appId = '1500042139491635200';
const userId = '12345678901234567';
const otherId = '22345678901234567';
const bridgeKey = 'test-bridge-key-0123456789012345678901234567890';
const serviceRole = 'test-service-role';

async function sealedSecret(value) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(`valtrexcloud-aes-v1\0${serviceRole}`));
  const key = await webcrypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `v1:${Buffer.from(iv).toString('base64')}:${Buffer.from(encrypted).toString('base64')}`;
}

test('o botão OAuth direto valida o usuário, consome o state uma vez e só então registra o consentimento', async () => {
  const tenant = { id: appId, client_id: appId, client_secret_cipher: await sealedSecret('fake-secret'),
    guild_id: '1554355246828888095', bot_key_hash: hash(bridgeKey) };
  const states = [];
  const consents = [];
  let currentUser = otherId;
  let handler;
  const db = {
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(field, value) { filters.push(row => row[field] === value); return query; },
        is(field, value) { filters.push(row => row[field] === value); return query; },
        gt(field, value) { filters.push(row => row[field] > value); return query; },
        async maybeSingle() {
          const source = table === 'valtrex_tenants' ? [tenant] : table === 'valtrex_oauth_states' ? states : [];
          return { data: source.find(row => filters.every(check => check(row))) || null, error: null };
        },
        async insert(value) {
          if (table === 'valtrex_oauth_states') states.push({ ...value, used_at: null });
          return { error: null };
        },
        async upsert(value) {
          if (table === 'valtrex_consents') consents.push(value);
          return { error: null };
        },
      };
      return query;
    },
    async rpc(name, args) {
      if (name === 'valtrex_rate_limit') return { data: true, error: null };
      if (name === 'valtrex_claim_verify') return { data: 'verification-id', error: null };
      assert.equal(name, 'valtrex_take_oauth_state_v2');
      const row = states.find(item => item.state_hash === args.p_state_hash &&
        item.verifier_hash === args.p_verifier_hash && !item.used_at && new Date(item.expires_at) > new Date());
      if (row) row.used_at = new Date().toISOString();
      return { data: row ? [row] : [], error: null };
    },
  };
  const source = readFileSync(new URL('../supabase/functions/valtrex-cloud/index.ts', import.meta.url), 'utf8')
    .replace(/^import \{ createClient \} from 'npm:@supabase\/supabase-js@[^']+';\s*/u, '');
  const code = transformSync(source, { loader: 'ts', format: 'iife', target: 'es2022' }).code;
  const context = {
    createClient: () => db,
    Deno: { env: { get: name => name === 'SUPABASE_SERVICE_ROLE_KEY' ? serviceRole : null }, serve: fn => { handler = fn; } },
    fetch: async url => {
      if (url.includes('/oauth2/token')) return Response.json({ access_token: 'access', refresh_token: 'refresh',
        token_type: 'Bearer', scope: 'identify guilds.join', expires_in: 3600 });
      if (url.includes('/users/@me')) return Response.json({ id: currentUser });
      throw new Error(`Unexpected fetch: ${url}`);
    },
    crypto: webcrypto, TextEncoder, TextDecoder, URL, URLSearchParams, Response, Request, AbortSignal,
    Uint8Array, Date, Math, atob, btoa, console,
  };
  vm.runInNewContext(code, context, { timeout: 2000 });
  assert.equal(typeof handler, 'function');

  const requestLink = () => new Request('https://example.test/valtrex-cloud/bot/oauth-link', {
    method: 'POST', headers: { authorization: `Bearer ${bridgeKey}`, 'x-valtrex-application': appId },
    body: JSON.stringify({ userId }),
  });
  tenant.guild_id = null;
  const pending = await handler(requestLink());
  assert.equal(pending.status, 409);
  assert.match((await pending.json()).error, /servidor principal/);
  assert.equal(states.length, 0);
  tenant.guild_id = '1554355246828888095';

  const start = await handler(requestLink());
  assert.equal(start.status, 200);
  const { url } = await start.json();
  const authorize = new URL(url);
  assert.equal(authorize.hostname, 'discord.com');
  assert.equal(authorize.pathname, '/oauth2/authorize');
  assert.equal(authorize.searchParams.get('prompt'), 'consent');
  assert.equal(authorize.searchParams.get('scope'), 'identify guilds.join');
  const state = authorize.searchParams.get('state');
  assert.equal(states[0].verifier_hash, hash(userId));

  const callbackUrl = `https://example.test/valtrex-cloud/auth/discord/callback?code=demo&state=${state}`;
  const wrong = await handler(new Request(callbackUrl));
  assert.match(wrong.headers.get('location'), /status=invalid$/);
  assert.equal(consents.length, 0);
  assert.equal(states[0].used_at, null);

  currentUser = userId;
  const right = await handler(new Request(callbackUrl));
  assert.match(right.headers.get('location'), /status=success$/);
  assert.equal(consents.length, 1);
  assert.ok(states[0].used_at);

  const replay = await handler(new Request(callbackUrl));
  assert.match(replay.headers.get('location'), /status=invalid$/);
  assert.equal(consents.length, 1);
});
