const configured = String(import.meta.env?.VITE_PUBLIC_BRAND || 'Cloud').trim().replace(/[<>@\r\n]/g, '').slice(0, 48);
export const BRAND = configured || 'Cloud';
export function displayName(value) {
  return String(value || '').replace(/Valtrex\s*Applications|Valtrex\s*Cloud/gi, BRAND)
    .replace(/Valtrexsallers/gi, 'Bot de Vendas').replace(/Valtrexbuxx/gi, 'Bot de Robux').replace(/\bValtrex\b/gi, BRAND);
}
