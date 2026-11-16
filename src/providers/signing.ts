import { createHmac, timingSafeEqual } from 'node:crypto';

export type HeaderBag = Headers | Record<string, string | string[] | undefined>;

export function hmacHex(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Comparação em tempo constante de dois hex; tamanhos diferentes dão falso. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b)) return false;
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export function header(headers: HeaderBag, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined;
  const bag = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(bag).find((k) => k.toLowerCase() === name.toLowerCase());
  const v = key ? bag[key] : undefined;
  return Array.isArray(v) ? v[0] : v;
}
