import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('build publica a marca nova sem credenciais no frontend', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const assets = new URL('../dist/assets/', import.meta.url);
  const js = readdirSync(assets).filter(name => name.endsWith('.js'))
    .map(name => readFileSync(new URL(name, assets), 'utf8')).join('\n');
  assert.match(html, /Cloud/);
  assert.match(js, /SEU WORKSPACE/);
  assert.doesNotMatch(js, /SUPABASE_SERVICE_ROLE_KEY|client_secret_cipher|VALTREX_CLOUD_API_KEY/);
});

test('rotas de Gift e callback passam pelo backend isolado', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.rewrites[0].source, '/api/:path*');
  assert.match(config.rewrites[0].destination, /functions\/v1\/valtrex-cloud/);
  assert.equal(config.rewrites.find(rule => rule.source === '/plans')?.destination, '/plans/index.html');
  assert.equal(config.rewrites.find(rule => rule.source === '/(.*)')?.destination, '/index.html');
});

test('planos têm HTML rastreável e links de compra dependem do convite oficial', () => {
  const html = readFileSync(new URL('../dist/plans/index.html', import.meta.url), 'utf8');
  const robots = readFileSync(new URL('../dist/robots.txt', import.meta.url), 'utf8');
  const sitemap = readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  const plans = readFileSync(new URL('../src/plans.jsx', import.meta.url), 'utf8');
  assert.match(html, /Planos Vendas e Robux/);
  assert.match(robots, /Disallow: \/g\//);
  assert.match(sitemap, /\/plans/);
  assert.match(plans, /catalog\.officialInvite \? <a/);
  assert.doesNotMatch(plans, /discord\.gg\/[A-Za-z0-9]/);
});
