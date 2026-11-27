/**
 * Site instalável (decisão do dono, 27/11): o manifesto deixa o celular
 * adicionar a Reforce à tela inicial, com nome, cores e ícones da marca.
 */
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('manifesto do app', () => {
  it('abre em tela cheia, com nome, cores e ícones 192 e 512 (comum e adaptável)', () => {
    const m = manifest();
    expect(m).toMatchObject({ name: 'Reforce', short_name: 'Reforce', start_url: '/', scope: '/', display: 'standalone', lang: 'pt-BR' });
    const icons = m.icons ?? [];
    for (const size of ['192x192', '512x512']) {
      expect(icons.some((i) => i.sizes === size && i.purpose === 'any')).toBe(true);
    }
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
    for (const i of icons) expect(i.src).toMatch(/^\/assets\/icons\/app\/[\w-]+\.png$/);
  });
});
