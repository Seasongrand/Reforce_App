/** Telefone e distância no formato que o brasileiro lê, a partir do que o banco guarda. */
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/** "+5511977776666" → "(11) 97777-6666". Texto que não é telefone volta como veio. */
export function formatPhoneBR(e164: string | null): string {
  if (!e164) return '';
  const p = parsePhoneNumberFromString(e164, 'BR');
  return p?.isValid() ? p.formatNational() : e164;
}

/** "5.0" → "5"; "5.5" → "5,5". */
export function formatKm(value: string | number | null): string {
  if (value === null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n).replace('.', ',') : String(value);
}
