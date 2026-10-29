export function isDashboardPath(path) { return ['/dashboard','/login','/entrar','/painel','/app','/auth/login'].includes(String(path).replace(/\/+$/, '') || '/'); }
