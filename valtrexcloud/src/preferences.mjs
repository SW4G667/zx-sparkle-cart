export const PUBLIC_PRESETS = {
  dark: { primary: '#f5f5f5', secondary: '#d4d4d8', background: '#09090b', card: '#121214', border: '#303034', text: '#fafafa' },
  light: { primary: '#171717', secondary: '#404040', background: '#f5f5f5', card: '#ffffff', border: '#d4d4d8', text: '#171717' },
  red: { primary: '#ff6d87', secondary: '#ffc2cc', background: '#10090d', card: '#1b1016', border: '#492430', text: '#fff1f4' },
  blue: { primary: '#9cbcff', secondary: '#cee0ff', background: '#080d17', card: '#101b2e', border: '#293c5e', text: '#f1f5ff' },
  purple: { primary: '#c6a7ff', secondary: '#e7d7ff', background: '#100b19', card: '#1c132b', border: '#423054', text: '#fbf5ff' },
  green: { primary: '#62dfb4', secondary: '#b9f4df', background: '#08130f', card: '#10251c', border: '#285242', text: '#effff8' },
  contrast: { primary: '#ffffff', secondary: '#ffffff', background: '#000000', card: '#000000', border: '#ffffff', text: '#ffffff' },
};
export const DEFAULT_PREFERENCES = { theme: 'dark', density: 'comfortable', layout: 'grid', sort: 'name', reducedMotion: false, expiryNotice: true, hideIds: false, timezone: 'local', favorites: [] };
export function normalizePreferences(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  return {
    theme: ['dark', 'light', 'system', 'red', 'blue', 'purple', 'green', 'contrast'].includes(input.theme) ? input.theme : 'dark',
    density: input.density === 'compact' ? 'compact' : 'comfortable',
    layout: input.layout === 'list' ? 'list' : 'grid',
    sort: ['name', 'expiry', 'status'].includes(input.sort) ? input.sort : 'name',
    reducedMotion: input.reducedMotion === true, expiryNotice: input.expiryNotice !== false,
    hideIds: input.hideIds === true, timezone: input.timezone === 'UTC' ? 'UTC' : 'local',
    favorites: Array.isArray(input.favorites) ? [...new Set(input.favorites.filter(id => typeof id === 'string' && /^[\w:-]{1,100}$/.test(id)))].slice(0, 100) : [],
  };
}
export function formatDate(value, timezone = 'local') {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return 'Não informado';
  return date.toLocaleString('pt-BR', timezone === 'UTC' ? { timeZone: 'UTC' } : undefined) + (timezone === 'UTC' ? ' UTC' : '');
}
export function readPreferences(storage) {
  try { return normalizePreferences(JSON.parse(storage.getItem('cloud.preferences.v1') || '{}')); }
  catch { return { ...DEFAULT_PREFERENCES }; }
}
export function filterApps(apps, query = '', status = 'all', sort = 'name') {
  const term = query.trim().toLocaleLowerCase('pt-BR');
  return apps.filter(app => (!term || `${app.label} ${app.id} ${app.profile}`.toLocaleLowerCase('pt-BR').includes(term)) &&
    (status === 'all' || app.status === status)).sort((a, b) => {
      if (sort === 'expiry') {
        const aDate = Date.parse(a.expiresAt), bDate = Date.parse(b.expiresAt);
        return (Number.isFinite(aDate) ? aDate : Infinity) - (Number.isFinite(bDate) ? bDate : Infinity) || String(a.label).localeCompare(String(b.label), 'pt-BR');
      }
      if (sort === 'status') return String(a.status).localeCompare(String(b.status)) || String(a.label).localeCompare(String(b.label), 'pt-BR');
      return String(a.label).localeCompare(String(b.label), 'pt-BR');
    });
}
export function filterLogs(logs, query = '', since = '') {
  const time = since ? new Date(`${since}T00:00:00`).getTime() : 0;
  return logs.filter(row => String(row.event || '').toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')) &&
    (!time || Date.parse(row.created_at) >= time));
}
export function logsCsv(logs) {
  const quote = value => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""') + '"';
  return '\uFEFF' + [['Data UTC', 'Evento'], ...logs.map(row => [row.created_at, row.event])].map(row => row.map(quote).join(';')).join('\r\n');
}
export function safeInvite(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.search && !u.hash &&
    ((u.hostname === 'discord.gg' && /^\/[\w-]+\/?$/.test(u.pathname)) || (u.hostname === 'discord.com' && /^\/invite\/[\w-]+\/?$/.test(u.pathname))) ? u.href : null; }
  catch { return null; }
}
