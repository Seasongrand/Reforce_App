/**
 * Divide o valor bruto de uma aula entre plataforma e professor (§3.4).
 * A comissão da plataforma é calculada sobre o preço cheio e arredondada
 * meio para cima, em centavos; o professor fica com o resto, de modo que as
 * duas partes sempre somam o total (restrição de payouts).
 */
export function splitCommission(grossCents: number, bps: number): { platform: number; teacher: number } {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) throw new RangeError(`valor bruto inválido: ${grossCents}`);
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError(`comissão inválida: ${bps}`);
  const platform = Math.floor((grossCents * bps + 5_000) / 10_000);
  return { platform, teacher: grossCents - platform };
}
