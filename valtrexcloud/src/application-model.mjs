import { displayName } from './branding.mjs';
export const applicationTypes = { sales: 'Sallers · Vendas', robux: 'Buxx · Robux', other: 'Aplicação' };
export const applicationStatuses = { active: 'Plano ativo', suspended: 'Suspensa', expired: 'Plano vencido', unknown: 'Sem prazo informado' };
export function ownedApps(session) {
  const cloud = session?.apps || [], managed = session?.managedApps || [], matched = new Set(), seen = new Set(), result = [];
  for (const item of managed) {
    const tenant = cloud.find(app => app.id === item.bot_id || app.id === item.manager_app_id);
    const identity = item.bot_id || item.manager_app_id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (tenant) matched.add(tenant.id);
    result.push({ key: `manager:${item.manager_app_id}`, id: item.manager_app_id, label: displayName(item.label), cloudId: tenant?.id || null,
      profile: item.profile || 'other', status: item.status || 'unknown', expiresAt: item.expires_at,
      botId: item.bot_id, syncedAt: item.synced_at, connectedAt: tenant?.bot_seen_at, source: 'manager' });
  }
  for (const item of cloud) if (!matched.has(item.id)) result.push({ key: `cloud:${item.id}`, id: item.id,
    label: displayName(item.label), cloudId: item.id, botId: item.id, profile: 'other', status: 'unknown',
    expiresAt: null, connectedAt: item.bot_seen_at, source: 'cloud' });
  return result;
}
export function resolveApplication(apps, key) {
  return apps.find(app => app.key === key || key === `cloud:${app.cloudId}`) || apps[0] || null;
}
export function searchApplications(apps, term) {
  const query = String(term || '').trim().toLocaleLowerCase('pt-BR');
  return query ? apps.filter(app => `${app.label} ${app.id} ${app.botId || ''} ${applicationTypes[app.profile]} ${applicationStatuses[app.status]}`.toLocaleLowerCase('pt-BR').includes(query)) : apps;
}
