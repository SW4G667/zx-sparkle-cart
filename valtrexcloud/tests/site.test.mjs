import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('build publica a marca nova sem credenciais no frontend', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const assets = new URL('../dist/assets/', import.meta.url);
  const js = readdirSync(assets).filter(name => name.endsWith('.js'))
    .map(name => readFileSync(new URL(name, assets), 'utf8')).join('\n');
  assert.match(html, /ValtrexApplications/);
  assert.match(js, /ValtrexApplications/);
  assert.doesNotMatch(js, /SUPABASE_SERVICE_ROLE_KEY|client_secret_cipher|VALTREX_CLOUD_API_KEY/);
});

test('rotas de Gift e callback passam pelo backend isolado', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.rewrites[0].source, '/api/:path*');
  assert.match(config.rewrites[0].destination, /functions\/v1\/valtrex-cloud/);
  assert.equal(config.rewrites[1].destination, '/index.html');
});
