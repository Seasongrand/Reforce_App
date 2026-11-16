/**
 * Código da aula presencial (§2.6): a família o recebe na confirmação e o
 * informa na chegada; o professor o digita no painel. Derivado por HMAC do id
 * da aula, para ser mostrado de novo sem guardar o código em claro; no banco
 * fica só um hash, também com segredo.
 */
import { hmacHex } from '@/providers/signing';

export function checkinCode(bookingId: string, secret: string): string {
  const n = parseInt(hmacHex(secret, `checkin|${bookingId}`).slice(0, 12), 16) % 1_000_000;
  return String(n).padStart(6, '0');
}

export function checkinHash(bookingId: string, code: string, secret: string): string {
  return hmacHex(secret, `checkin-hash|${bookingId}|${code}`);
}
