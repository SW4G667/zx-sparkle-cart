#!/usr/bin/env node
// Auditoria somente de leitura. Não imprime ambiente, credenciais ou arquivos do usuário.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function read(path) {
  try { return fs.readFileSync(path, 'utf8').trim(); } catch { return null; }
}
function limit(path) {
  const value = read(path);
  return value && /^\d+$/.test(value) && BigInt(value) < (1n << 60n) ? Number(value) : null;
}
function which(name) {
  return (process.env.PATH || '').split(path.delimiter).some(directory => {
    try {
      fs.accessSync(path.join(directory, name), fs.constants.X_OK);
      return true;
    } catch { return false; }
  });
}
function version(name) {
  if (!which(name)) return null;
  const result = spawnSync(name, ['--version'], { timeout: 3000, encoding: 'utf8' });
  return (result.stdout || result.stderr || '').split('\n')[0].slice(0, 120) || null;
}
function status(name) {
  return (read('/proc/self/status') || '').split('\n')
    .find(line => line.startsWith(name + ':'))?.split(':')[1]?.trim() || null;
}
const release = {};
for (const line of (read('/etc/os-release') || '').split('\n')) {
  const match = line.match(/^(ID|VERSION_ID|PRETTY_NAME)=(.*)$/);
  if (match) release[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, '');
}
const max = (read('/sys/fs/cgroup/cpu.max') || '').split(' ');
const quota = max.length === 2 && /^\d+$/.test(max[0]) && /^\d+$/.test(max[1]) && Number(max[1]) > 0
  ? Math.round(Number(max[0]) / Number(max[1]) * 100) / 100 : null;
const names = ['Xvfb', 'Xorg', 'openbox', 'tint2', 'xterm', 'x11vnc', 'Xtigervnc',
  'vncserver', 'websockify', 'novnc_proxy', 'flatpak', 'glxinfo', 'eglinfo',
  'vulkaninfo', 'ffmpeg', 'docker', 'apt-get', 'apk', 'bash', 'python3', 'node', 'npm'];
const executables = Object.fromEntries(names.map(name => [name, which(name)]));
const disk = fs.statfsSync('.');
const dri = (() => { try { return fs.readdirSync('/dev/dri').sort(); } catch { return []; } })();
const ports = Object.fromEntries(['SERVER_PORT', 'PORT']
  .filter(name => /^\d+$/.test(process.env[name] || ''))
  .map(name => [name, Number(process.env[name])]));
console.log(JSON.stringify({
  diagnostic_schema: 2,
  runtime: { node: process.version, python: version('python3'), kernel: os.release(),
    architecture: os.arch(), distribution: release },
  cpu: { visible_logical_processors: os.cpus().length, quota_cores: quota,
    cpuset_effective: read('/sys/fs/cgroup/cpuset.cpus.effective') },
  memory: { limit_bytes: limit('/sys/fs/cgroup/memory.max') ??
      limit('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
    current_bytes: limit('/sys/fs/cgroup/memory.current'),
    swap_limit_bytes: limit('/sys/fs/cgroup/memory.swap.max') },
  storage: { filesystem_total_bytes: disk.blocks * disk.bsize,
    filesystem_free_bytes: disk.bavail * disk.bsize,
    cwd_writable: (() => { try { fs.accessSync('.', fs.constants.W_OK); return true; }
      catch { return false; } })(),
    note: 'O tamanho do sistema de arquivos pode diferir da cota do painel.' },
  container: { uid: process.getuid?.() ?? null, docker_marker: fs.existsSync('/.dockerenv'),
    seccomp_mode: status('Seccomp'), no_new_privileges: status('NoNewPrivs') },
  graphics: { dri_devices: dri }, executables,
  network: { configured_ports: ports,
    note: 'Porta configurada não comprova publicação HTTPS ou acesso externo.' },
}));
