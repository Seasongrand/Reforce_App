/** Centavos para "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cent = String(abs % 100).padStart(2, '0');
  return `${neg ? '-' : ''}R$ ${reais},${cent}`;
}

/**
 * Preço digitado ("121,00", "121.00", "1.234,56", "R$ 150") em centavos; null se não for um preço.
 * Com vírgula, o ponto é separador de milhar; sem vírgula, ponto com 1 ou 2 casas é decimal.
 */
export function parsePriceBR(text: string): number | null {
  const t = text.replace(/R\$/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  let int: string;
  let dec = '';
  const commas = (t.match(/,/g) ?? []).length;
  if (commas > 1) return null;
  if (commas === 1) {
    const [a, b] = t.split(',') as [string, string];
    if (!/^\d{1,2}$/.test(b) || !/^(\d{1,3}(\.\d{3})*|\d+)$/.test(a)) return null;
    int = a.replace(/\./g, '');
    dec = b;
  } else {
    const decimal = /^(\d+)\.(\d{1,2})$/.exec(t);
    if (decimal) [, int, dec] = decimal as unknown as [string, string, string];
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) int = t.replace(/\./g, '');
    else if (/^\d+$/.test(t)) int = t;
    else return null;
  }
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
