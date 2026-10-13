const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {URL} = require('node:url');

const port = Number(process.env.ZENYX_PANEL_PORT || 50104);
const dataDir = process.env.ZENYX_DATA_DIR || path.join(process.env.HOME || process.cwd(), '.zenyx-panel');
const desktopUrl = process.env.ZENYX_DESKTOP_URL || 'https://astrosallers.enzonic.dev/vnc.html';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Porta inválida');
if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?\/vnc\.html$/i.test(desktopUrl)) throw Error('URL do desktop inválida');
fs.mkdirSync(dataDir, {recursive: true, mode: 0o700});
const authPath = path.join(dataDir, 'auth.json');
const firstLoginPath = path.join(dataDir, 'primeiro-acesso.txt');
if (!fs.existsSync(authPath)) {
  const password = crypto.randomBytes(18).toString('base64url');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  fs.writeFileSync(authPath, JSON.stringify({salt: salt.toString('hex'), hash: hash.toString('hex')}), {mode: 0o600, flag: 'wx'});
  fs.writeFileSync(firstLoginPath, password + '\n', {mode: 0o600, flag: 'wx'});
  console.log('Senha inicial criada em arquivo privado: ' + firstLoginPath);
}
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const salt = Buffer.from(auth.salt, 'hex');
const expected = Buffer.from(auth.hash, 'hex');
if (salt.length !== 16 || expected.length !== 64) throw Error('Arquivo de autenticação inválido');
const sessions = new Map();
const attempts = new Map();
const sessionMs = 12 * 60 * 60 * 1000;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cookie = req => (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('sid='))?.slice(4);
function authenticated(req) {
  const token = cookie(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = crypto.createHash('sha256').update(token).digest('hex');
  const expires = sessions.get(key);
  if (!expires || expires < Date.now()) { sessions.delete(key); return null; }
  return key;
}
function passwordMatches(value) {
  const candidate = crypto.scryptSync(value, salt, 64);
  return crypto.timingSafeEqual(candidate, expected);
}
function page(content) {
  return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Zenyx Cloud Desktop</title>' +
    '<style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:radial-gradient(circle at 80% 0,#1c3159,#090e1c 65%);color:#eff5ff;font:16px system-ui,sans-serif;display:grid;place-items:center;padding:20px}main{width:min(100%,480px);background:#121d32;border:1px solid #344560;border-radius:24px;padding:28px;box-shadow:0 20px 70px #0008}small{color:#7fb5ff;letter-spacing:.13em;font-weight:800}h1{font-size:clamp(1.7rem,7vw,2.3rem);margin:12px 0 8px}p{color:#b9c9df;line-height:1.55}.status{border-radius:12px;padding:14px;margin:20px 0;background:#213047}.ok{color:#8ff0bd}.bad{color:#ffbc9e}input,button,a.button{width:100%;min-height:52px;margin-top:12px;padding:12px 16px;border-radius:12px;font:inherit}input{background:#0b1426;border:1px solid #587099;color:white}button,a.button{display:block;background:#5c8cff;color:white;border:0;text-align:center;text-decoration:none;font-weight:700}footer{margin-top:20px;color:#91a5c2;font-size:.85rem}</style>' +
    '<main><small>ZENYX CLOUD DESKTOP V2</small>' + content + '</main></html>';
}
function send(res, status, body, extra = {}) {
  res.writeHead(status, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra});
  res.end(body);
}
async function desktopStatus() {
  try {
    const response = await fetch(desktopUrl, {redirect:'manual',signal:AbortSignal.timeout(5000)});
    return {ready:response.status === 200, detail:'HTTP ' + response.status};
  } catch {
    return {ready:false, detail:'sem resposta'};
  }
}
function prune() {
  const now = Date.now();
  for (const [key, expiry] of sessions) if (expiry < now) sessions.delete(key);
  for (const [key, state] of attempts) if (state.start + 600000 < now) attempts.delete(key);
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health' && req.method === 'GET') return send(res, 200, 'ok');
  if (url.pathname === '/login' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) return send(res, 413, page('<h1>Pedido muito grande</h1>'));
    }
    prune();
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const state = attempts.get(ip) || {count:0,start:now};
    state.count++;
    attempts.set(ip, state);
    const supplied = new URLSearchParams(body).get('password') || '';
    if (state.count > 8 || supplied.length > 256 || !passwordMatches(supplied))
      return send(res, 403, page('<h1>Acesso negado</h1><p>Credencial incorreta ou limite de tentativas.</p>'));
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(crypto.createHash('sha256').update(token).digest('hex'), now + sessionMs);
    res.writeHead(303, {'Location':'/','Cache-Control':'no-store',
      'Set-Cookie':'sid=' + token + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200'});
    return res.end();
  }
  if (url.pathname === '/logout' && req.method === 'POST') {
    const key = authenticated(req);
    if (key) sessions.delete(key);
    return send(res, 200, page('<h1>Sessão encerrada</h1><a class="button" href="/">Voltar</a>'),
      {'Set-Cookie':'sid=; Max-Age=0; HttpOnly; Secure; SameSite=Strict; Path=/'});
  }
  if (url.pathname !== '/' || req.method !== 'GET') return send(res, 404, page('<h1>Não encontrado</h1>'));
  if (!authenticated(req)) return send(res, 200, page('<h1>Seu desktop Linux</h1><p>Entre para verificar a sessão remota.</p><form method="post" action="/login"><input name="password" type="password" autocomplete="current-password" aria-label="Senha" required><button>Entrar</button></form>'));
  const status = await desktopStatus();
  const indicator = status.ready ? '<span class="ok">Disponível</span>' : '<span class="bad">Indisponível</span>';
  const action = status.ready ? '<a class="button" href="' + escape(desktopUrl) + '?resize=scale" rel="noopener noreferrer">Abrir desktop</a>' : '<p>O acesso público da Enzonic ainda não alcança o servidor gráfico.</p>';
  return send(res, 200, page('<h1>Painel de sessão</h1><div class="status">Desktop: ' + indicator + ' · ' + escape(status.detail) + '</div>' + action + '<form method="post" action="/logout"><button>Sair</button></form><footer>Estado medido no endereço HTTPS do desktop. Atualize a página para consultar novamente.</footer>'));
}).listen(port, '0.0.0.0', () => console.log('Painel Zenyx ouvindo na porta ' + port));
