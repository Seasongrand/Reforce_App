/**
 * Modo "lista de espera": enquanto não há provedores reais (e-mail, pagamento),
 * o site público mostra só a página inicial com a lista de espera de
 * professores; as rotas do marketplace ficam fechadas.
 */
import { describe, expect, it } from 'vitest';
import { isPathOpenInWaitlistMode } from '@/domain/site-mode';
import { loadConfig, marketplaceReady } from '@/config';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5433/aulas',
  SESSION_SECRET: 's'.repeat(32),
  FILE_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('rotas abertas no modo lista de espera', () => {
  it.each(['/', '/privacidade', '/termos', '/manifest.webmanifest', '/apple-icon.png', '/api/saude', '/api/lista-de-espera.csv', '/_next/static/chunks/a.js', '/favicon.ico', '/opengraph-image', '/opengraph-image-12o0cb', '/icon.svg', '/professores', '/entrar', '/api/lista-de-espera/alunos.csv', '/equipe', '/api/lista-de-espera/curriculo/6f1c2c1e-0000-4000-8000-000000000001',
    '/assets/system.css', '/assets/moments/pinned-chapters/moment.js', '/assets/img/aula-1200.webp'])(
    'abre %s',
    (p) => expect(isPathOpenInWaitlistMode(p)).toBe(true),
  );
  it.each([
    '/professor', '/professor/entrar', '/interno', '/interno/entrar', '/p/ana', '/p/ana/reservar', '/pedido/x', '/aula/x',
    '/dev', '/dev/sala/x', '/api/webhooks/pagamento', '/api/dev/pagar', '/api/pedido/x/estado', '/api/interno/arquivos',
    '/privacidade/../professor', '/opengraph-image/x', '/opengraph-image-12o0cb/../professor',
    '/buscar',
    '/api/lista-de-espera/curriculo/x', '/entrar/x', '/api/lista-de-espera/alunos', '/equipe/x', '/api/lista-de-espera/curriculo/6f1c2c1e-0000-4000-8000-000000000001/y',
    '/assets', '/assets/../professor', '/assetsx/a.css',
  ])('fecha %s', (p) => expect(isPathOpenInWaitlistMode(p)).toBe(false));
});

describe('configuração do modo do site', () => {
  it('o padrão é o site completo', () => {
    expect(loadConfig(base).siteMode).toBe('completo');
    expect(loadConfig({ ...base, SITE_MODE: 'lista_de_espera' }).siteMode).toBe('lista_de_espera');
    expect(() => loadConfig({ ...base, SITE_MODE: 'outro' })).toThrow(/SITE_MODE/);
  });

  it('em produção, adaptador falso só é aceito no modo lista de espera, que não usa provedores', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/PAYMENT_PROVIDER/);
    expect(loadConfig({ ...base, NODE_ENV: 'production', SITE_MODE: 'lista_de_espera' }).siteMode).toBe('lista_de_espera');
  });

  it('ferramentas de desenvolvimento nunca sobem em produção', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SITE_MODE: 'lista_de_espera', DEV_TOOLS: '1' }))
      .toThrow(/DEV_TOOLS/);
  });

  it('senha da exportação, quando definida, precisa ser longa', () => {
    expect(() => loadConfig({ ...base, WAITLIST_EXPORT_PASSWORD: 'curta' })).toThrow(/WAITLIST_EXPORT_PASSWORD/);
    expect(loadConfig({ ...base, WAITLIST_EXPORT_PASSWORD: 'uma-senha-longa-o-bastante' }).waitlistExportPassword)
      .toBe('uma-senha-longa-o-bastante');
    expect(loadConfig(base).waitlistExportPassword).toBeNull();
  });

  it('o marketplace roda no site completo e, na lista de espera, só para a equipe com as duas chaves', () => {
    const { SESSION_SECRET, FILE_ENCRYPTION_KEY, ...noKeys } = base;
    expect(marketplaceReady(loadConfig(base))).toBe(true);
    expect(marketplaceReady(loadConfig({ ...base, SITE_MODE: 'lista_de_espera' }))).toBe(true);
    expect(marketplaceReady(loadConfig({ ...noKeys, SITE_MODE: 'lista_de_espera' }))).toBe(false);
    expect(marketplaceReady(loadConfig({ ...noKeys, SESSION_SECRET, SITE_MODE: 'lista_de_espera' }))).toBe(false);
    expect(marketplaceReady(loadConfig({ ...noKeys, FILE_ENCRYPTION_KEY, SITE_MODE: 'lista_de_espera' }))).toBe(false);
  });
});
