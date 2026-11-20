/**
 * Horário digitado pelo professor (Agenda): aceita 8, 8h, 8h30, 830, 0830,
 * 8:30, 08:30 e 8.30, e devolve "HH:MM". Qualquer outra coisa vira null.
 * Roda no navegador (para arrumar o campo) e no servidor (para conferir).
 */
export function parseTimeBR(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  let m = /^(\d{1,2})(?:[:h.](\d{2}))?h?$/.exec(t);
  if (!m && /^\d{3,4}$/.test(t)) m = [t, t.slice(0, -2), t.slice(-2)] as unknown as RegExpExecArray;
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2] ?? 0);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
