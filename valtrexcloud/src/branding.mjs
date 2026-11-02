const configured = String(import.meta.env?.VITE_PUBLIC_BRAND || 'Synx Applications').trim().replace(/[<>@\r\n]/g, '').slice(0, 48);
export const BRAND = !configured || /^(?:Cloud|Valtrex(?:\s*(?:Applications|Cloud))?)$/i.test(configured) ? 'Synx Applications' : configured;
export function displayName(value) {
  return String(value || '').replace(/Valtrex\s*Applications|Valtrex\s*Cloud/gi, BRAND)
    .replace(/\b(?:ValtrexSallers|Sallers|Bot de Vendas)\b/gi, 'SynxPro').replace(/\b(?:Valtrexbuxx|Buxx|Bot (?:de )?Robux)\b/gi, 'SynxBux').replace(/\bValtrex\b/gi, BRAND).replace(/^Cloud$/i, BRAND);
}
