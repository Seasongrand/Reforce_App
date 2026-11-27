/**
 * Cabeçalhos de segurança em todas as respostas (revisão de segurança, 27/11):
 * só HTTPS, nenhuma página dentro de moldura de outro site, sem adivinhar o
 * tipo de arquivo, endereço completo só para o próprio site.
 */
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

describe('cabeçalhos de segurança', () => {
  it('valem para todas as rotas', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === '/:path*');
    const h = Object.fromEntries((all?.headers ?? []).map((x) => [x.key.toLowerCase(), x.value]));
    expect(h['strict-transport-security']).toMatch(/^max-age=\d{8,}/);
    expect(h['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toMatch(/geolocation=\(\)/);
  });
});
